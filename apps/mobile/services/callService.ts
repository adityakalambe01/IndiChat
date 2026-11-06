/**
 * apps/mobile/services/callService.ts
 *
 * Production WebRTC Call Engine for IndiChat Mobile.
 *
 * Capabilities:
 *  - Real 1-to-1 audio and video calls over WebRTC
 *  - Compatible with web CallModal.tsx via existing 'call.signal' envelope
 *  - Strict glare resolution using deterministic, locale-independent ASCII user ID comparison
 *  - Busy handling for incoming calls while in another call session
 *  - Ringing (30s) and Connection (15s) timeouts with graceful recovery
 *  - Safe candidate queuing before remote description is set
 *  - Native audio routing integration (speakerphone, earpiece, audio focus via AudioRouteModule)
 *  - Connected timer starts ONLY when both transport is connected AND remote track is attached
 *  - Media reception verification via getStats inbound-rtp monitoring
 *  - Full hardware track release and call history recording on termination
 */

import { CallSignalPayload } from '@chat/shared-types';
import { wsClient } from './websocket';
import { storage, STORAGE_KEYS } from './storage';
import { callHistoryService } from './callHistory';
import { audioRouteService } from './audioRoute';
import { generateUUID } from '../utils/uuid';

export type CallState =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended';

export type TerminationReason =
  | 'user_ended'
  | 'user_declined'
  | 'caller_cancelled'
  | 'user_busy'
  | 'timeout'
  | 'connection_failed'
  | 'media_error';

export interface ActiveCallSession {
  sessionId: string;
  peerId: string;
  peerName: string;
  isVideo: boolean;
  isIncoming: boolean;
  conversationId?: string;
  startedAt: number;
  connectedAt: number | null;
  duration: number; // in seconds
  state: CallState;
  statusText: string;
  terminationReason?: TerminationReason;
  // Controls
  isMuted: boolean;
  isVideoMuted: boolean;
  isSpeakerOn: boolean;
  isFrontCamera: boolean;
  isPeerMuted: boolean;
  // Media flow verification
  isReceivingMedia: boolean;
  inboundPacketsReceived: number;
  inboundBytesReceived: number;
  // WebRTC References
  localStream: any;
  remoteStream: any;
}

export type CallStateListener = (session: ActiveCallSession | null) => void;

/**
 * Deterministic ASCII comparison of normalized user IDs.
 * Returns -1 if idA < idB, 1 if idA > idB, 0 if equal.
 */
export function compareUserIds(idA: string, idB: string): number {
  const normA = (idA || '').trim().toLowerCase();
  const normB = (idB || '').trim().toLowerCase();
  if (normA < normB) return -1;
  if (normA > normB) return 1;
  return 0;
}

/**
 * Safe ICE candidate handler for production call connections.
 * Queues candidates if remote description is not yet applied,
 * and validates session ID / sender to protect against stale packets.
 */
export class SafeIceCandidateQueue {
  private pc: any;
  private peerId: string;
  private sessionId?: string;
  private remoteDescriptionSet = false;
  private queuedCandidates: any[] = [];

  constructor(pc: any, peerId: string, sessionId?: string) {
    this.pc = pc;
    this.peerId = peerId;
    this.sessionId = sessionId;
  }

  public attachPc(pc: any): void {
    this.pc = pc;
    if (this.remoteDescriptionSet) {
      this.drain();
    }
  }

  public setRemoteDescriptionApplied(): void {
    this.remoteDescriptionSet = true;
    this.drain();
  }

  private drain(): void {
    while (this.queuedCandidates.length > 0) {
      const cand = this.queuedCandidates.shift();
      if (cand && this.pc && this.pc.signalingState !== 'closed') {
        try {
          this.pc.addIceCandidate(cand);
        } catch (err) {
          console.warn('[CallService] Error applying queued candidate:', err);
        }
      }
    }
  }

  public addCandidate(signal: CallSignalPayload): boolean {
    const data = signal.data as any;
    if (!data) return false;

    // Validate correlation if session ID present
    if (this.sessionId && data.callSessionId) {
      if (data.callSessionId !== this.sessionId) {
        console.warn('[CallService] Stale candidate ignored for session:', data.callSessionId);
        return false;
      }
    } else if (signal.senderUserId && signal.senderUserId !== this.peerId) {
      console.warn('[CallService] Candidate sender mismatch:', signal.senderUserId);
      return false;
    }

    const iceInit: any = {
      candidate: data.candidate || data.sdp || '',
      sdpMid: data.sdpMid,
      sdpMLineIndex: data.sdpMLineIndex,
    };

    if (!this.remoteDescriptionSet || !this.pc) {
      this.queuedCandidates.push(iceInit);
      return true;
    }

    if (this.pc.signalingState === 'closed') {
      return false;
    }

    try {
      this.pc.addIceCandidate(iceInit);
      return true;
    } catch (err) {
      console.warn('[CallService] addIceCandidate failed:', err);
      return false;
    }
  }

  public clear(): void {
    this.queuedCandidates = [];
  }
}

class CallService {
  private currentSession: ActiveCallSession | null = null;
  private pc: any = null;
  private candidateQueue: SafeIceCandidateQueue | null = null;
  private listeners = new Set<CallStateListener>();
  private currentUserId: string | null = null;

  // Timers
  private ringingTimer: any = null;
  private connectionTimer: any = null;
  private reconnectGraceTimer: any = null;
  private durationInterval: any = null;
  private statsInterval: any = null;
  private cleanupTimer: any = null;

  // Timeouts configuration (ms)
  private readonly RINGING_TIMEOUT_MS = 30000;
  private readonly CONNECTION_TIMEOUT_MS = 15000;
  private readonly RECONNECT_GRACE_MS = 5000;

  // Pending incoming offer data (stored during incoming_ringing)
  private pendingIncomingOfferData: any = null;

  constructor() {
    // Listen for WebSocket call signals
    wsClient.onCallSignal((signal) => {
      this.handleIncomingSignal(signal);
    });

    // Cache current user ID
    this.refreshCurrentUserId();
  }

  public async refreshCurrentUserId(): Promise<string | null> {
    try {
      const user = await storage.getJson<any>(STORAGE_KEYS.CURRENT_USER);
      if (user && user.id) {
        this.currentUserId = user.id;
        return user.id;
      }
    } catch {}
    return null;
  }

  public getSession(): ActiveCallSession | null {
    return this.currentSession;
  }

  public onSessionChange(fn: CallStateListener): () => void {
    this.listeners.add(fn);
    fn(this.currentSession);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    const copy = this.currentSession ? { ...this.currentSession } : null;
    this.listeners.forEach((fn) => fn(copy));
  }

  /**
   * Acquire local camera and/or microphone tracks.
   */
  private async acquireLocalMedia(wantVideo: boolean): Promise<{ stream: any; error?: string }> {
    try {
      const webrtc = await import('react-native-webrtc');
      if (!webrtc.mediaDevices || typeof webrtc.mediaDevices.getUserMedia !== 'function') {
        return { stream: null, error: 'Media devices API unavailable' };
      }

      const stream = await webrtc.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo
          ? {
              facingMode: 'user',
              frameRate: 30,
            }
          : false,
      });

      return { stream };
    } catch (err: any) {
      console.warn('[CallService] Primary getUserMedia failed:', err?.message || err);
      // Fallback: If video failed, attempt audio-only
      if (wantVideo) {
        try {
          const webrtc = await import('react-native-webrtc');
          const audioStream = await webrtc.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          return { stream: audioStream };
        } catch (audioErr: any) {
          return { stream: null, error: audioErr?.message || 'Microphone unavailable' };
        }
      }
      return { stream: null, error: err?.message || 'Permission or hardware acquisition error' };
    }
  }

  /**
   * Start an outgoing call to targetUserId.
   */
  public async startCall(params: {
    targetUserId: string;
    targetName: string;
    isVideo: boolean;
    conversationId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (this.currentSession && this.currentSession.state !== 'idle' && this.currentSession.state !== 'ended') {
      return { success: false, error: 'Another call is currently active.' };
    }

    await this.refreshCurrentUserId();
    const myId = this.currentUserId;
    if (!myId) {
      return { success: false, error: 'Cannot initiate call: User is not authenticated.' };
    }

    const sessionId = generateUUID();

    // 1. Acquire local media
    const { stream: localStream, error: mediaErr } = await this.acquireLocalMedia(params.isVideo);
    if (!localStream) {
      return { success: false, error: mediaErr || 'Failed to acquire microphone/camera.' };
    }

    // Determine actual video presence
    const hasVideo = localStream.getVideoTracks().length > 0;

    // 2. Initialize RTCPeerConnection
    let webrtc: any;
    try {
      webrtc = await import('react-native-webrtc');
    } catch (e: any) {
      localStream.getTracks().forEach((t: any) => t.stop());
      return { success: false, error: 'WebRTC module not available.' };
    }

    const pc = new webrtc.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    this.pc = pc;

    this.candidateQueue = new SafeIceCandidateQueue(pc, params.targetUserId, sessionId);

    // Create remote stream container
    const remoteStream = new webrtc.MediaStream();

    this.currentSession = {
      sessionId,
      peerId: params.targetUserId,
      peerName: params.targetName,
      isVideo: hasVideo,
      isIncoming: false,
      conversationId: params.conversationId,
      startedAt: Date.now(),
      connectedAt: null,
      duration: 0,
      state: 'outgoing_ringing',
      statusText: 'Calling...',
      isMuted: false,
      isVideoMuted: !hasVideo,
      isSpeakerOn: false,
      isFrontCamera: true,
      isPeerMuted: false,
      isReceivingMedia: false,
      inboundPacketsReceived: 0,
      inboundBytesReceived: 0,
      localStream,
      remoteStream,
    };

    // Attach local tracks to PC
    localStream.getTracks().forEach((track: any) => {
      pc.addTrack(track, localStream);
    });

    // Wire PC event listeners
    this.bindPeerConnectionEvents(pc, remoteStream);

    // Initialize native audio routing
    try {
      const session = this.currentSession;
      const generation = this.audioRouteGeneration;
      const result = await audioRouteService.startCallAudio(hasVideo);
      if (this.currentSession !== session || generation !== this.audioRouteGeneration) return { success: false, error: 'Call ended during audio setup.' };
      if (result.success && session) {
        session.isSpeakerOn = result.currentRoute === 'speaker';
      }
    } catch (e) {
      console.warn('[CallService] AudioRoute initialization note:', e);
    }

    this.notify();

    // 3. Create and send SDP Offer
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: params.isVideo,
      });
      await pc.setLocalDescription(offer);

      const myUser = await storage.getJson<any>(STORAGE_KEYS.CURRENT_USER);
      const myDisplayName = myUser?.displayName || myUser?.name || myUser?.username || 'IndiChat User';

      wsClient.sendCallSignal({
        targetUserId: params.targetUserId,
        signalType: 'offer',
        data: {
          callSessionId: sessionId,
          sdp: offer,
          isVideo: hasVideo,
          callerName: myDisplayName,
        },
      });

      // Start ringing timeout
      this.clearTimers();
      this.ringingTimer = setTimeout(() => {
        this.handleRingingTimeout();
      }, this.RINGING_TIMEOUT_MS);

      return { success: true };
    } catch (err: any) {
      console.error('[CallService] Failed to create offer:', err);
      await this.terminateCall('media_error', 'Call failed to initialize.');
      return { success: false, error: err?.message || 'Failed to create call offer.' };
    }
  }

  /**
   * Handle incoming call signal from WebSocket.
   */
  public async handleIncomingSignal(signal: CallSignalPayload): Promise<void> {
    const signalType = signal.signalType;
    const senderId = signal.senderUserId;
    const data = (signal.data as any) || {};

    if (!senderId) return;
    await this.refreshCurrentUserId();
    const myId = this.currentUserId;

    // --- 1. INCOMING OFFER ---
    if (signalType === 'offer') {
      const incomingSessionId = data.callSessionId || `legacy-${senderId}`;
      const isVideo = Boolean(data.isVideo);
      const callerName = data.callerName || 'IndiChat Contact';

      // Check if we are already in an active or pending call
      if (this.currentSession && this.currentSession.state !== 'idle' && this.currentSession.state !== 'ended') {
        // Check for GLARE: Offer from the same peer we are currently calling
        if (
          (this.currentSession.state === 'outgoing_ringing' || this.currentSession.state === 'connecting') &&
          this.currentSession.peerId === senderId
        ) {
          const comparison = compareUserIds(myId || '', senderId);
          console.log(`[CallService] Call glare detected with ${senderId}. ASCII comparison: ${comparison}`);

          if (comparison < 0) {
            // Local user is the LOSER: Drop outgoing call and yield to incoming offer
            console.log('[CallService] Glare resolution: Local user yields. Answering incoming offer.');
            this.clearTimers();
            if (this.pc) {
              try {
                this.pc.onconnectionstatechange = null;
                this.pc.oniceconnectionstatechange = null;
                this.pc.onicecandidate = null;
                this.pc.ontrack = null;
                this.pc.close();
              } catch {}
              this.pc = null;
            }
            if (this.candidateQueue) {
              this.candidateQueue.clear();
              this.candidateQueue = null;
            }

            // Adopt incoming offer directly
            this.pendingIncomingOfferData = data;
            await this.acceptCallInternal(senderId, callerName, isVideo, incomingSessionId);
            return;
          } else {
            // Local user is the WINNER: Ignore incoming offer; the remote peer will yield
            console.log('[CallService] Glare resolution: Local user wins. Ignoring incoming offer.');
            return;
          }
        }

        // Same peer re-sending offer while already in incoming ringing: update pending offer data
        if (this.currentSession.state === 'incoming_ringing' && this.currentSession.peerId === senderId) {
          console.log(`[CallService] Re-received incoming offer from same peer ${senderId}. Updating pending offer data.`);
          this.pendingIncomingOfferData = data;
          this.currentSession.sessionId = incomingSessionId;
          this.currentSession.isVideo = isVideo;
          this.currentSession.peerName = callerName;
          this.notify();
          return;
        }

        // BUSY: Already in another call with a different peer or already connected
        console.log(`[CallService] Busy: Rejecting offer from ${senderId} while in call with ${this.currentSession.peerId}`);
        wsClient.sendCallSignal({
          targetUserId: senderId,
          signalType: 'hangup',
          data: {
            callSessionId: incomingSessionId,
            reason: 'user_busy',
          },
        });
        return;
      }

      // Fresh incoming call
      console.log('[CallService] Fresh incoming offer from', senderId, 'session:', incomingSessionId);
      this.pendingIncomingOfferData = data;
      this.candidateQueue = new SafeIceCandidateQueue(null, senderId, incomingSessionId);
      this.currentSession = {
        sessionId: incomingSessionId,
        peerId: senderId,
        peerName: callerName,
        isVideo,
        isIncoming: true,
        conversationId: undefined,
        startedAt: Date.now(),
        connectedAt: null,
        duration: 0,
        state: 'incoming_ringing',
        statusText: `Incoming ${isVideo ? 'Video' : 'Voice'} Call...`,
        isMuted: false,
        isVideoMuted: !isVideo,
        isSpeakerOn: false,
        isFrontCamera: true,
        isPeerMuted: false,
        isReceivingMedia: false,
        inboundPacketsReceived: 0,
        inboundBytesReceived: 0,
        localStream: null,
        remoteStream: null,
      };

      this.notify();

      // Start incoming ringing timeout
      this.clearTimers();
      this.ringingTimer = setTimeout(() => {
        this.handleRingingTimeout();
      }, this.RINGING_TIMEOUT_MS);
      return;
    }

    // --- 2. INCOMING ANSWER ---
    if (signalType === 'answer') {
      if (!this.currentSession || this.currentSession.state === 'idle') return;

      // Session correlation check
      if (data.callSessionId && this.currentSession.sessionId && data.callSessionId !== this.currentSession.sessionId) {
        console.warn('[CallService] Answer ignored: Session ID mismatch');
        return;
      }
      if (senderId !== this.currentSession.peerId) {
        console.warn('[CallService] Answer ignored: Sender mismatch');
        return;
      }

      console.log('[CallService] Received answer from peer.');
      this.clearTimer('ringing');

      this.currentSession.state = 'connecting';
      this.currentSession.statusText = 'Connecting...';
      this.notify();

      // Start connection timeout
      this.connectionTimer = setTimeout(() => {
        this.handleConnectionTimeout();
      }, this.CONNECTION_TIMEOUT_MS);

      const sdp = data.sdp;
      if (sdp && this.pc && this.pc.signalingState !== 'closed') {
        try {
          const webrtc = await import('react-native-webrtc');
          await this.pc.setRemoteDescription(new webrtc.RTCSessionDescription(sdp));
          this.candidateQueue?.setRemoteDescriptionApplied();
        } catch (e) {
          console.warn('[CallService] Error setting remote description on answer:', e);
        }
      }
      return;
    }

    // --- 3. INCOMING ICE CANDIDATE ---
    if (signalType === 'ice-candidate') {
      if (!this.currentSession) return;
      this.candidateQueue?.addCandidate(signal);
      return;
    }

    // --- 4. INCOMING HANGUP ---
    if (signalType === 'hangup') {
      if (!this.currentSession || this.currentSession.state === 'idle') return;

      // Check session ID correlation
      if (data.callSessionId && this.currentSession.sessionId && data.callSessionId !== this.currentSession.sessionId) {
        console.warn('[CallService] Stale hangup signal ignored');
        return;
      }
      if (senderId !== this.currentSession.peerId) {
        return;
      }

      const reason: TerminationReason = data.reason || 'user_ended';
      console.log('[CallService] Remote peer hung up call. Reason:', reason);
      await this.terminateCall(reason, this.formatHangupReasonText(reason), false);
    }
  }

  /**
   * User accepts an incoming call.
   */
  public async acceptIncomingCall(): Promise<boolean> {
    if (!this.currentSession || this.currentSession.state !== 'incoming_ringing') {
      return false;
    }
    console.log('[CallService] User accepted incoming call:', this.currentSession.sessionId);

    const senderId = this.currentSession.peerId;
    const callerName = this.currentSession.peerName;
    const isVideo = this.currentSession.isVideo;
    const sessionId = this.currentSession.sessionId;

    return await this.acceptCallInternal(senderId, callerName, isVideo, sessionId);
  }

  private async acceptCallInternal(
    senderId: string,
    callerName: string,
    wantVideo: boolean,
    sessionId: string
  ): Promise<boolean> {
    this.clearTimer('ringing');

    // Acquire local media
    const { stream: localStream, error: mediaErr } = await this.acquireLocalMedia(wantVideo);
    if (!localStream) {
      await this.declineIncomingCall();
      return false;
    }

    const hasVideo = localStream.getVideoTracks().length > 0;

    let webrtc: any;
    try {
      webrtc = await import('react-native-webrtc');
    } catch {
      localStream.getTracks().forEach((t: any) => t.stop());
      return false;
    }

    const pc = new webrtc.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    this.pc = pc;

    if (!this.candidateQueue) {
      this.candidateQueue = new SafeIceCandidateQueue(pc, senderId, sessionId);
    } else {
      this.candidateQueue.attachPc(pc);
    }
    const remoteStream = new webrtc.MediaStream();

    this.currentSession = {
      sessionId,
      peerId: senderId,
      peerName: callerName,
      isVideo: hasVideo,
      isIncoming: true,
      startedAt: Date.now(),
      connectedAt: null,
      duration: 0,
      state: 'connecting',
      statusText: 'Connecting...',
      isMuted: false,
      isVideoMuted: !hasVideo,
      isSpeakerOn: false,
      isFrontCamera: true,
      isPeerMuted: false,
      isReceivingMedia: false,
      inboundPacketsReceived: 0,
      inboundBytesReceived: 0,
      localStream,
      remoteStream,
    };

    localStream.getTracks().forEach((track: any) => {
      pc.addTrack(track, localStream);
    });

    this.bindPeerConnectionEvents(pc, remoteStream);

    try {
      const session = this.currentSession;
      const generation = this.audioRouteGeneration;
      const result = await audioRouteService.startCallAudio(hasVideo);
      if (this.currentSession !== session || generation !== this.audioRouteGeneration) return false;
      if (result.success && session) {
        session.isSpeakerOn = result.currentRoute === 'speaker';
      }
    } catch (e) {
      console.warn('[CallService] AudioRoute note on accept:', e);
    }

    this.notify();

    // Set remote description from pending offer
    const offerSdp = this.pendingIncomingOfferData?.sdp;
    if (offerSdp && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(offerSdp));
        this.candidateQueue?.setRemoteDescriptionApplied();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsClient.sendCallSignal({
          targetUserId: senderId,
          signalType: 'answer',
          data: {
            callSessionId: sessionId,
            sdp: answer,
          },
        });

        // Start connection timeout
        this.connectionTimer = setTimeout(() => {
          this.handleConnectionTimeout();
        }, this.CONNECTION_TIMEOUT_MS);

        return true;
      } catch (err) {
        console.warn('[CallService] Error generating answer:', err);
      }
    }

    // Fallback answer
    wsClient.sendCallSignal({
      targetUserId: senderId,
      signalType: 'answer',
      data: {
        callSessionId: sessionId,
      },
    });

    return true;
  }

  /**
   * User explicitly declines an incoming call.
   */
  public async declineIncomingCall(): Promise<void> {
    if (!this.currentSession || this.currentSession.state !== 'incoming_ringing') return;
    console.log('[CallService] User declined incoming call:', this.currentSession.sessionId);

    const peerId = this.currentSession.peerId;
    const sessionId = this.currentSession.sessionId;

    wsClient.sendCallSignal({
      targetUserId: peerId,
      signalType: 'hangup',
      data: {
        callSessionId: sessionId,
        reason: 'user_declined',
      },
    });

    await this.terminateCall('user_declined', 'Call declined', false);
  }

  /**
   * User hangs up or cancels an outgoing call.
   */
  public async hangupCall(): Promise<void> {
    if (!this.currentSession || this.currentSession.state === 'idle') return;

    const peerId = this.currentSession.peerId;
    const sessionId = this.currentSession.sessionId;
    const isRinging = this.currentSession.state === 'outgoing_ringing';
    const reason: TerminationReason = isRinging ? 'caller_cancelled' : 'user_ended';

    wsClient.sendCallSignal({
      targetUserId: peerId,
      signalType: 'hangup',
      data: {
        callSessionId: sessionId,
        reason,
      },
    });

    await this.terminateCall(reason, isRinging ? 'Call cancelled' : 'Call ended', false);
  }

  /**
   * Toggle microphone mute (does NOT disconnect or end call).
   */
  public toggleMute(): boolean {
    if (!this.currentSession || !this.currentSession.localStream) return false;
    const nextMuted = !this.currentSession.isMuted;
    this.currentSession.isMuted = nextMuted;

    this.currentSession.localStream.getAudioTracks().forEach((track: any) => {
      track.enabled = !nextMuted;
    });

    this.notify();
    return nextMuted;
  }

  /**
   * Toggle camera video mute.
   */
  public toggleVideoMute(): boolean {
    if (!this.currentSession || !this.currentSession.localStream) return false;
    const nextMuted = !this.currentSession.isVideoMuted;
    this.currentSession.isVideoMuted = nextMuted;

    this.currentSession.localStream.getVideoTracks().forEach((track: any) => {
      track.enabled = !nextMuted;
    });

    this.notify();
    return nextMuted;
  }

  /**
   * Switch between front and back camera.
   */
  public async switchCamera(): Promise<boolean> {
    if (!this.currentSession || !this.currentSession.localStream) return false;
    const videoTracks = this.currentSession.localStream.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const track = videoTracks[0];
    if (typeof track._switchCamera === 'function') {
      try {
        track._switchCamera();
        this.currentSession.isFrontCamera = !this.currentSession.isFrontCamera;
        this.notify();
        return true;
      } catch (e) {
        console.warn('[CallService] switchCamera error:', e);
      }
    }
    return false;
  }

  /**
   * Toggle speakerphone vs earpiece via native AudioRouteModule.
   */
  private audioRouteGeneration = 0;

  public async toggleSpeakerphone(): Promise<boolean> {
    const session = this.currentSession;
    const generation = this.audioRouteGeneration;
    if (!session || session.state === 'ended' || session.state === 'idle') return false;
    try {
      const result = await audioRouteService.setSpeakerphoneOn(!session.isSpeakerOn);
      if (generation !== this.audioRouteGeneration || this.currentSession !== session || (['ended', 'idle'] as string[]).includes(session.state)) return false;
      if (result.success) {
        session.isSpeakerOn = result.isSpeaker;
        this.notify();
      }
      return session.isSpeakerOn;
    } catch (e) {
      console.warn('[CallService] Failed to toggle speakerphone:', e);
      return this.currentSession === session && session.isSpeakerOn;
    }
  }

  /**
   * Bind event listeners to RTCPeerConnection.
   */
  private bindPeerConnectionEvents(pc: any, remoteStream: any): void {
    // 1. ICE Candidate generation
    pc.onicecandidate = (event: any) => {
      if (this.pc !== pc) return;
      if (event.candidate && this.currentSession) {
        wsClient.sendCallSignal({
          targetUserId: this.currentSession.peerId,
          signalType: 'ice-candidate',
          data: {
            callSessionId: this.currentSession.sessionId,
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };

    // 2. Track arrival
    pc.ontrack = (event: any) => {
      if (this.pc !== pc) return;
      console.log('[CallService] Remote track received:', event.track?.kind);
      if (event.track && this.currentSession) {
        const session = this.currentSession;
        // Event streams already have native track bindings. Prefer their react
        // tag so RTCView does not resolve a placeholder stream before tracks exist.
        if (event.streams?.[0]) session.remoteStream = event.streams[0];
        else remoteStream.addTrack(event.track);
        this.notify();

        // Listen for peer track mute/unmute
        event.track.onmute = () => {
          if (event.track.kind === 'audio' && this.currentSession === session && this.pc === pc) {
            this.currentSession.isPeerMuted = true;
            this.notify();
          }
        };
        event.track.onunmute = () => {
          if (event.track.kind === 'audio' && this.currentSession === session && this.pc === pc) {
            this.currentSession.isPeerMuted = false;
            this.notify();
          }
        };

        this.checkConnectedState();
      }
    };

    // 3. Connection State Change
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      console.log('[CallService] Connection state:', pc.connectionState);
      this.handleConnectionStateChange(pc.connectionState);
    };

    // 4. ICE Connection State Change (fallback)
    pc.oniceconnectionstatechange = () => {
      if (this.pc !== pc) return;
      console.log('[CallService] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.checkConnectedState();
      } else if (pc.iceConnectionState === 'disconnected') {
        this.handleDisconnectedGrace();
      } else if (pc.iceConnectionState === 'failed') {
        this.terminateCall('connection_failed', 'Connection failed');
      }
    };
  }

  private handleConnectionStateChange(state: string): void {
    if (state === 'connected') {
      this.clearTimer('connection');
      this.clearTimer('reconnectGrace');
      this.checkConnectedState();
    } else if (state === 'disconnected') {
      this.handleDisconnectedGrace();
    } else if (state === 'failed') {
      this.terminateCall('connection_failed', 'Connection lost');
    } else if (state === 'closed') {
      if (this.currentSession && this.currentSession.state !== 'ended') {
        this.terminateCall('user_ended', 'Call ended', false);
      }
    }
  }

  private handleDisconnectedGrace(): void {
    if (!this.currentSession || this.currentSession.state === 'reconnecting') return;
    this.currentSession.state = 'reconnecting';
    this.currentSession.statusText = 'Reconnecting...';
    this.notify();

    this.clearTimer('reconnectGrace');
    this.reconnectGraceTimer = setTimeout(() => {
      if (this.currentSession && this.currentSession.state === 'reconnecting') {
        this.terminateCall('connection_failed', 'Connection timed out');
      }
    }, this.RECONNECT_GRACE_MS);
  }

  /**
   * Evaluates whether both transport is connected AND remote track is attached.
   * Duration timer begins ONLY when this condition is fulfilled.
   */
  private checkConnectedState(): void {
    if (!this.currentSession || !this.pc) return;

    const transportConnected =
      this.pc.connectionState === 'connected' ||
      this.pc.iceConnectionState === 'connected' ||
      this.pc.iceConnectionState === 'completed';

    const hasRemoteTracks =
      this.currentSession.remoteStream &&
      typeof this.currentSession.remoteStream.getTracks === 'function' &&
      this.currentSession.remoteStream.getTracks().length > 0;

    if (transportConnected && hasRemoteTracks && this.currentSession.state !== 'connected') {
      console.log('[CallService] Transitioning to CONNECTED state. Transport OK, remote tracks present.');
      this.clearTimer('connection');
      this.clearTimer('reconnectGrace');

      this.currentSession.state = 'connected';
      this.currentSession.connectedAt = Date.now();
      this.currentSession.statusText = 'Connected';
      this.notify();

      // Start duration counter (every 1 second)
      if (this.durationInterval) clearInterval(this.durationInterval);
      this.durationInterval = setInterval(() => {
        if (this.currentSession && this.currentSession.state === 'connected') {
          this.currentSession.duration += 1;
          this.notify();
        }
      }, 1000);

      // Start inbound RTP stats monitoring (every 2 seconds)
      this.startStatsMonitoring();
    }
  }

  /**
   * Monitor inbound RTP flow to verify genuine media reception.
   */
  private startStatsMonitoring(): void {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      if (!this.currentSession || !this.pc || this.currentSession.state !== 'connected') return;

      if (typeof this.pc.getStats === 'function') {
        try {
          const stats = await this.pc.getStats();
          if (stats && typeof stats.forEach === 'function') {
            let totalPackets = 0;
            let totalBytes = 0;

            stats.forEach((report: any) => {
              if (report && report.type === 'inbound-rtp') {
                totalPackets += report.packetsReceived || 0;
                totalBytes += report.bytesReceived || 0;
              }
            });

            const delta = totalPackets - this.currentSession.inboundPacketsReceived;
            this.currentSession.inboundPacketsReceived = totalPackets;
            this.currentSession.inboundBytesReceived = totalBytes;
            this.currentSession.isReceivingMedia = totalPackets > 0 || delta > 0;
            this.notify();
          }
        } catch {
          // getStats may throw on early close
        }
      }
    }, 2000);
  }

  private handleRingingTimeout(): void {
    if (!this.currentSession) return;
    const isIncoming = this.currentSession.isIncoming;
    const reason: TerminationReason = 'timeout';

    if (!isIncoming) {
      wsClient.sendCallSignal({
        targetUserId: this.currentSession.peerId,
        signalType: 'hangup',
        data: {
          callSessionId: this.currentSession.sessionId,
          reason,
        },
      });
    }

    this.terminateCall(reason, isIncoming ? 'Missed call' : 'No answer', false);
  }

  private handleConnectionTimeout(): void {
    if (!this.currentSession) return;
    console.warn('[CallService] Connection timeout reached (15s). Terminating call.');
    wsClient.sendCallSignal({
      targetUserId: this.currentSession.peerId,
      signalType: 'hangup',
      data: {
        callSessionId: this.currentSession.sessionId,
        reason: 'connection_failed',
      },
    });

    this.terminateCall('connection_failed', 'Connection timed out', false);
  }

  /**
   * Clean teardown of all media, hardware, peer connections, and timers.
   */
  public async terminateCall(
    reason: TerminationReason = 'user_ended',
    statusText = 'Call ended',
    notifyPeer = true
  ): Promise<void> {
    this.audioRouteGeneration++;
    this.clearTimers();

    if (!this.currentSession) return;
    const session = this.currentSession;

    if (notifyPeer && session.peerId) {
      wsClient.sendCallSignal({
        targetUserId: session.peerId,
        signalType: 'hangup',
        data: {
          callSessionId: session.sessionId,
          reason,
        },
      });
    }

    // Immediately dismiss UI for cancelled, declined, or unanswered calls to prevent UI lag
    const isImmediateTeardown = reason === 'caller_cancelled' || reason === 'user_declined' || !session.connectedAt;
    if (isImmediateTeardown) {
      this.currentSession = null;
      this.pendingIncomingOfferData = null;
      this.notify();
    }

    // Release local media capture tracks
    if (session.localStream) {
      try {
        session.localStream.getTracks().forEach((track: any) => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      } catch (e) {
        console.warn('[CallService] Error releasing local tracks:', e);
      }
      session.localStream = null;
    }

    // Release the ending call before awaiting native routing. A new call may
    // start while that promise is pending; cleanup must never close its peer.
    const peer = this.pc;
    this.pc = null;
    if (peer) {
      try {
        peer.onconnectionstatechange = null;
        peer.oniceconnectionstatechange = null;
        peer.onicecandidate = null;
        peer.ontrack = null;
        peer.close();
      } catch {}
    }

    if (this.candidateQueue) {
      this.candidateQueue.clear();
      this.candidateQueue = null;
    }

    // Stop native audio routing and restore audio manager mode
    try {
      await audioRouteService.stopCallAudio();
    } catch (e) {
      console.warn('[CallService] AudioRoute cleanup note:', e);
    }

    // Record Call in persistent history
    const duration = session.duration;
    const durationStr =
      duration > 0
        ? duration < 60
          ? `${duration} sec`
          : `${Math.floor(duration / 60)} min ${duration % 60} sec`
        : reason === 'user_declined'
        ? 'Declined'
        : reason === 'timeout'
        ? session.isIncoming
          ? 'Missed'
          : 'No answer'
        : reason === 'user_busy'
        ? 'Busy'
        : '0 sec';

    const callType: 'incoming' | 'outgoing' | 'missed' = session.isIncoming
      ? duration > 0
        ? 'incoming'
        : 'missed'
      : 'outgoing';

    try {
      await callHistoryService.addCall({
        contactName: session.peerName,
        targetUserId: session.peerId,
        conversationId: session.conversationId,
        isVideo: session.isVideo,
        type: callType,
        duration: durationStr,
        subtitle: durationStr,
      });
    } catch (err) {
      console.warn('[CallService] Failed to record call in history:', err);
    }

    if (this.currentSession !== session) return;
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (!isImmediateTeardown) {
      // Brief ended state before resetting to idle for connected calls
      session.state = 'ended';
      session.statusText = statusText;
      session.terminationReason = reason;
      this.notify();

      this.cleanupTimer = setTimeout(() => {
        if (this.currentSession !== session) return;
        this.currentSession = null;
        this.pendingIncomingOfferData = null;
        this.cleanupTimer = null;
        this.notify();
      }, 400);
    }
  }

  private clearTimer(name: 'ringing' | 'connection' | 'reconnectGrace'): void {
    if (name === 'ringing' && this.ringingTimer) {
      clearTimeout(this.ringingTimer);
      this.ringingTimer = null;
    }
    if (name === 'connection' && this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (name === 'reconnectGrace' && this.reconnectGraceTimer) {
      clearTimeout(this.reconnectGraceTimer);
      this.reconnectGraceTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.ringingTimer) {
      clearTimeout(this.ringingTimer);
      this.ringingTimer = null;
    }
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (this.reconnectGraceTimer) {
      clearTimeout(this.reconnectGraceTimer);
      this.reconnectGraceTimer = null;
    }
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private formatHangupReasonText(reason: TerminationReason): string {
    switch (reason) {
      case 'user_declined':
        return 'Call declined';
      case 'user_busy':
        return 'User is busy';
      case 'caller_cancelled':
        return 'Call cancelled';
      case 'timeout':
        return 'No answer';
      case 'connection_failed':
        return 'Connection lost';
      case 'media_error':
        return 'Hardware/Media error';
      case 'user_ended':
      default:
        return 'Call ended';
    }
  }
}

export const callService = new CallService();
