import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, ShieldCheck, AlertCircle } from 'lucide-react';
import { wsClient } from '../../services/websocket';
import { callAudio } from '../../services/callAudio';
import { CallSignalPayload } from '@chat/shared-types';

interface CallModalProps {
  targetUserId: string;
  targetName: string;
  callerName?: string;
  isVideo: boolean;
  isIncoming?: boolean;
  incomingOfferData?: any;
  onHangup: (stats?: { duration: number; connected: boolean; isVideo: boolean }) => void;
  onAnswer?: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  targetUserId,
  targetName = 'IndiChat User',
  callerName = 'IndiChat User',
  isVideo: initialIsVideo,
  isIncoming = false,
  incomingOfferData,
  onHangup,
  onAnswer,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideo, setIsVideo] = useState(initialIsVideo);
  const [duration, setDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isCleaningUpRef = useRef(false);
  const callSessionIdRef = useRef<string>(
    incomingOfferData?.callSessionId ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  );

  // Initialize WebRTC and Signaling
  useEffect(() => {
    let isCancelled = false;
    isCleaningUpRef.current = false;

    // Create RTCPeerConnection with Google STUN servers
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    const remoteMediaStream = new MediaStream();
    // Attach remote stream tracks to media elements
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : remoteMediaStream;
      if (!event.streams || !event.streams[0]) {
        stream.addTrack(event.track);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play?.().catch(() => {});
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play?.().catch(() => {});
      }
    };

    // Forward ICE candidates to remote peer via WebSocket
    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserId) {
        wsClient.sendCallSignal({
          targetUserId,
          signalType: 'ice-candidate',
          data: {
            ...event.candidate.toJSON(),
            callSessionId: callSessionIdRef.current,
          },
        });
      }
    };

    // Helper to acquire local media stream with fallback
    const acquireMediaStream = async (wantVideo: boolean) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantVideo,
        });
        if (isCancelled || (pc.signalingState as string) === 'closed' || isCleaningUpRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }
        localStreamRef.current = stream;

        if (localVideoRef.current && wantVideo) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => {
          if ((pc.signalingState as string) !== 'closed' && !isCleaningUpRef.current) {
            pc.addTrack(track, stream);
          }
        });
        return stream;
      } catch (err: any) {
        if (isCancelled || (pc.signalingState as string) === 'closed' || isCleaningUpRef.current) return null;
        console.warn('[WebRTC] Primary getUserMedia failed:', err.message);
        if (wantVideo) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            if (isCancelled || (pc.signalingState as string) === 'closed' || isCleaningUpRef.current) {
              audioStream.getTracks().forEach((t) => t.stop());
              return null;
            }
            localStreamRef.current = audioStream;
            audioStream.getTracks().forEach((track) => {
              if ((pc.signalingState as string) !== 'closed' && !isCleaningUpRef.current) {
                pc.addTrack(track, audioStream);
              }
            });
            setIsVideo(false);
            setMediaWarning('Camera unavailable; switched to audio call.');
            return audioStream;
          } catch (e: any) {
            console.warn('[WebRTC] Audio-only getUserMedia also failed:', e.message);
            setMediaWarning('Microphone access unavailable in this environment.');
          }
        } else {
          setMediaWarning('Microphone access unavailable in this environment.');
        }
        return null;
      }
    };

    if (!isIncoming) {
      // Outgoing call: play ringback, acquire media, and send offer
      callAudio.playOutgoingRing();
      acquireMediaStream(initialIsVideo).then(async (stream) => {
        if (isCancelled || !stream || (pc.signalingState as string) === 'closed' || isCleaningUpRef.current) return;
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: initialIsVideo,
          });
          if (isCancelled || (pc.signalingState as string) === 'closed' || isCleaningUpRef.current) return;
          await pc.setLocalDescription(offer);

          wsClient.sendCallSignal({
            targetUserId,
            signalType: 'offer',
            data: {
              sdp: offer,
              isVideo: initialIsVideo,
              callerName,
              callSessionId: callSessionIdRef.current,
            },
          });
        } catch (offerErr) {
          console.error('[WebRTC] Failed to create offer:', offerErr);
        }
      });
    } else {
      // Incoming call: start melodic ringtone, await user click on Answer
      callAudio.playIncomingRing();
    }

    // Listen to WebSocket call signals for answer, ICE candidates, and hangup
    const unsubSignal = wsClient.onCallSignal(async (signal: CallSignalPayload) => {
      if (isCleaningUpRef.current) return;

      const sigData = (signal.data as any) || {};
      if (sigData.callSessionId && callSessionIdRef.current && sigData.callSessionId !== callSessionIdRef.current) {
        console.warn('[WebRTC] Stale signal ignored:', sigData.callSessionId);
        return;
      }

      if (signal.signalType === 'answer') {
        console.log('[WebRTC] Received call answer from peer');
        callAudio.stopAll();
        setConnected(true);

        const sdp = sigData.sdp;
        if (sdp && pc.signalingState !== 'closed') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            // Drain queued candidates
            while (queuedCandidatesRef.current.length > 0) {
              const cand = queuedCandidatesRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          } catch (e) {
            console.warn('[WebRTC] Error setting remote description for answer:', e);
          }
        }
      } else if (signal.signalType === 'ice-candidate') {
        const cand = sigData;
        if (cand && pc.signalingState !== 'closed') {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] Error adding ice candidate:', e);
            }
          } else {
            queuedCandidatesRef.current.push(cand);
          }
        }
      } else if (signal.signalType === 'hangup') {
        const reason = sigData.reason;
        console.log('[WebRTC] Remote peer hung up call. Reason:', reason);
        let reasonNotice = '';
        if (reason === 'user_declined') reasonNotice = 'Call was declined by peer.';
        else if (reason === 'user_busy') reasonNotice = 'User is busy on another call.';
        else if (reason === 'caller_cancelled') reasonNotice = 'Call was cancelled by caller.';
        else if (reason === 'timeout') reasonNotice = 'Call timed out (no answer).';

        if (reasonNotice) {
          setMediaWarning(reasonNotice);
          setTimeout(() => endCall(false), 1200);
        } else {
          endCall(false);
        }
      }
    });

    return () => {
      isCancelled = true;
      unsubSignal();
      callAudio.stopAll();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }
    };
  }, []);

  // Duration counter when connected
  useEffect(() => {
    let interval: number;
    if (connected) {
      interval = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [connected]);

  // Clean teardown helper
  const endCall = (notifyPeer = true, reason: string = 'user_ended') => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    callAudio.stopAll();
    if (connected) {
      callAudio.playHangupTone();
    }

    if (notifyPeer && targetUserId) {
      wsClient.sendCallSignal({
        targetUserId,
        signalType: 'hangup',
        data: {
          callSessionId: callSessionIdRef.current,
          reason,
        },
      });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }

    onHangup({ duration, connected, isVideo });
  };

  // Answer call handler
  const handleAcceptCall = async () => {
    callAudio.stopAll();
    setConnected(true);
    onAnswer?.();

    const pc = pcRef.current;
    if (!pc) return;

    // Acquire local media upon accepting call
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: initialIsVideo,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current && initialIsVideo) {
        localVideoRef.current.srcObject = stream;
      }
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    } catch (e: any) {
      console.warn('[WebRTC] getUserMedia failed on accept:', e.message);
      if (initialIsVideo) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = audioStream;
          audioStream.getTracks().forEach((track) => pc.addTrack(track, audioStream));
          setIsVideo(false);
          setMediaWarning('Camera unavailable; switched to audio call.');
        } catch (ae) {
          setMediaWarning('Microphone access unavailable.');
        }
      }
    }

    const offerSdp = incomingOfferData?.sdp;
    if (offerSdp && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        while (queuedCandidatesRef.current.length > 0) {
          const cand = queuedCandidatesRef.current.shift();
          if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsClient.sendCallSignal({
          targetUserId,
          signalType: 'answer',
          data: {
            sdp: answer,
            callSessionId: callSessionIdRef.current,
          },
        });
        return;
      } catch (e) {
        console.warn('[WebRTC] Error generating answer SDP:', e);
      }
    }

    // Fallback answer signal
    wsClient.sendCallSignal({
      targetUserId,
      signalType: 'answer',
      data: {
        callSessionId: callSessionIdRef.current,
      },
    });
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
  };

  const toggleVideo = async () => {
    const nextVideo = !isVideo;
    setIsVideo(nextVideo);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = nextVideo;
      });
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 9999 }}>
      {/* Hidden audio element for remote stream in voice calls */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* VIDEO CALL LAYOUT */}
      {isVideo && (connected || !isIncoming) ? (
        <div className="call-dialog-video">
          {/* Main Remote Video Screen */}
          <div className="call-remote-video-wrap">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="call-remote-video"
            />
            {/* Overlay if remote video hasn't arrived or is off */}
            <div className="call-video-placeholder-overlay">
              <div className="call-pulse-ring" style={{ width: '100px', height: '100px' }}>
                <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '2rem' }}>
                  {targetName.charAt(0).toUpperCase()}
                </div>
              </div>
              <h3 style={{ marginTop: '16px', color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>
                {targetName}
              </h3>
              <p style={{ color: '#8696a0', fontSize: '0.9rem', marginTop: '4px' }}>
                {connected ? `Video Call • ${formatDuration(duration)}` : 'Calling...'}
              </p>
            </div>

            {/* Local PiP Video Preview */}
            <div className="call-local-pip">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="call-local-video"
              />
              <span className="call-pip-label">You</span>
            </div>
          </div>

          {/* Top Banner with security badge & media warnings */}
          <div className="call-video-topbar">
            <div className="call-encryption-pill">
              <ShieldCheck size={14} color="#25D366" />
              <span>End-to-end encrypted</span>
            </div>
            {mediaWarning && (
              <div className="call-warning-pill">
                <AlertCircle size={14} color="#f59e0b" />
                <span>{mediaWarning}</span>
              </div>
            )}
          </div>

          {/* Floating Controls Bar */}
          <div className="call-video-controls">
            <button
              className="call-ctrl-btn"
              style={{
                backgroundColor: isMuted ? 'var(--accent-danger)' : 'rgba(255,255,255,0.18)',
                color: '#fff',
              }}
              onClick={toggleMute}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button
              className="call-ctrl-btn"
              style={{
                backgroundColor: isVideo ? 'var(--accent-primary)' : 'rgba(255,255,255,0.18)',
                color: isVideo ? '#111b21' : '#fff',
              }}
              onClick={toggleVideo}
              title={isVideo ? 'Turn off camera' : 'Turn on camera'}
            >
              {isVideo ? <Video size={22} /> : <VideoOff size={22} />}
            </button>

            <button
              className="btn-hangup"
              style={{ width: '56px', height: '56px' }}
              onClick={() => endCall(true)}
              title="End Call"
            >
              <PhoneOff size={26} />
            </button>
          </div>
        </div>
      ) : (
        /* VOICE CALL / INCOMING DIALOG */
        <div className="call-dialog call-dialog-voice">
          <div className="call-encryption-pill" style={{ marginBottom: '8px' }}>
            <ShieldCheck size={14} color="#25D366" />
            <span>End-to-end encrypted</span>
          </div>

          <div className="call-pulse-ring">
            <div className="avatar" style={{ width: '72px', height: '72px', fontSize: '1.75rem' }}>
              {targetName.charAt(0).toUpperCase()}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {targetName}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isIncoming && !connected
                ? `Incoming ${isVideo ? 'Video' : 'Voice'} Call...`
                : connected
                ? `${isVideo ? 'Video Call' : 'Voice Call'} • ${formatDuration(duration)}`
                : 'Calling...'}
            </p>
            {mediaWarning && (
              <p style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '6px' }}>
                {mediaWarning}
              </p>
            )}
          </div>

          {connected || !isIncoming ? (
            <div style={{ display: 'flex', gap: '18px', marginTop: '16px', alignItems: 'center' }}>
              <button
                className="icon-btn"
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: isMuted ? 'var(--accent-danger)' : 'var(--bg-active)',
                  color: '#fff',
                  borderRadius: '50%',
                }}
                onClick={toggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              <button
                className="icon-btn"
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: isVideo ? 'var(--accent-primary)' : 'var(--bg-active)',
                  color: isVideo ? '#111b21' : '#fff',
                  borderRadius: '50%',
                }}
                onClick={toggleVideo}
                title={isVideo ? 'Turn off video' : 'Switch to video call'}
              >
                {isVideo ? <Video size={22} /> : <VideoOff size={22} />}
              </button>

              <button
                className="btn-hangup"
                style={{ width: '52px', height: '52px' }}
                onClick={() => endCall(true)}
                title="End Call"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '28px', marginTop: '20px', alignItems: 'center' }}>
              <button
                className="btn-hangup"
                style={{ width: '56px', height: '56px' }}
                onClick={() => endCall(true)}
                title="Decline"
              >
                <PhoneOff size={26} />
              </button>

              <button
                className="icon-btn"
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#111b21',
                  borderRadius: '50%',
                  boxShadow: '0 4px 15px rgba(37, 211, 102, 0.4)',
                }}
                onClick={handleAcceptCall}
                title="Answer Call"
              >
                <Phone size={26} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
