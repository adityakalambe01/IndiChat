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

  // Derive avatar initials and color
  const avatarInitials =
    targetName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || targetName.slice(0, 2).toUpperCase();

  const avatarColor = '#10b981';

  return (
    <div
      className="call-simulation-overlay"
      id="callOverlay"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(circle at 50% 30%, #0d2822 0%, #060e12 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '40px 24px',
        zIndex: 99999,
        color: '#ffffff',
        animation: 'fadeInModal 0.25s ease-out',
      }}
      role="dialog"
      aria-label={`${isVideo ? 'Video' : 'Audio'} Call with ${targetName}`}
    >
      {/* Hidden audio element for remote stream in voice calls */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* VIDEO CALL REMOTE SCREEN & PIP */}
      {isVideo && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              display: connected ? 'block' : 'none',
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1,
            }}
          />
          <div
            style={{
              display: connected ? 'block' : 'none',
              position: 'absolute',
              bottom: '120px',
              right: '28px',
              width: '160px',
              height: '120px',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              border: '2px solid rgba(255,255,255,0.3)',
              zIndex: 2,
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        </>
      )}

      {/* 1. Top Status Pill */}
      <div style={{ textAlign: 'center', marginTop: '10px', zIndex: 3 }}>
        <span
          className="platform-pill"
          style={{
            color: 'var(--brand-emerald, #10b981)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '5px 14px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isIncoming && !connected
            ? `Incoming ${isVideo ? 'Video' : 'Voice'} Call`
            : connected
            ? `End-to-End Encrypted · ${isVideo ? 'Video' : 'Voice'} Call`
            : `Connecting ${isVideo ? 'Video' : 'Voice'} Call...`}
        </span>
      </div>

      {/* 2. Middle Hero: Avatar, Name, Timer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 3,
        }}
      >
        <div
          className="call-hero-avatar"
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '32px',
            fontSize: '32px',
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            background: avatarColor,
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
            marginBottom: '16px',
          }}
        >
          {avatarInitials}
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 750, margin: 0, color: '#ffffff' }}>
          {targetName}
        </h2>
        <div
          className="call-timer"
          id="callTimerLabel"
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '14px',
            color: 'var(--brand-emerald, #10b981)',
            marginTop: '6px',
          }}
        >
          {isIncoming && !connected
            ? 'Incoming call...'
            : connected
            ? formatDuration(duration)
            : 'Connecting...'}
        </div>
        {mediaWarning && (
          <div
            style={{
              fontSize: '12px',
              color: '#f59e0b',
              marginTop: '10px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '4px 12px',
              borderRadius: '8px',
            }}
          >
            ⚠️ {mediaWarning}
          </div>
        )}
      </div>

      {/* 3. Call Controls Bar */}
      <div
        className="call-controls-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          zIndex: 3,
        }}
      >
        {isIncoming && !connected ? (
          <>
            <button
              type="button"
              className="call-ctrl-btn end-call"
              id="endCallBtn"
              aria-label="Decline call"
              title="Decline"
              onClick={() => endCall(true)}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#ea4335',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                cursor: 'pointer',
                fontSize: '22px',
                fontWeight: 'bold',
                boxShadow: '0 4px 16px rgba(234, 67, 53, 0.4)',
              }}
            >
              ✕
            </button>
            <button
              type="button"
              className="call-ctrl-btn"
              id="btnAcceptCall"
              aria-label="Answer call"
              title="Answer Call"
              onClick={handleAcceptCall}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--brand-emerald, #10b981)',
                color: '#05080b',
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                cursor: 'pointer',
                fontSize: '22px',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
              }}
            >
              📞
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`call-ctrl-btn ${isMuted ? 'active' : ''}`}
              id="callMuteBtn"
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              title={isMuted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: isMuted ? 'var(--brand-emerald, #10b981)' : 'rgba(255, 255, 255, 0.15)',
                color: isMuted ? '#05080b' : '#ffffff',
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'all 0.15s ease',
              }}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            <button
              type="button"
              className={`call-ctrl-btn ${!isVideo ? 'active' : ''}`}
              id="callVideoBtn"
              aria-label={isVideo ? 'Turn off camera' : 'Turn on camera'}
              title={isVideo ? 'Camera off' : 'Camera on'}
              onClick={toggleVideo}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: !isVideo ? 'var(--brand-emerald, #10b981)' : 'rgba(255, 255, 255, 0.15)',
                color: !isVideo ? '#05080b' : '#ffffff',
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'all 0.15s ease',
              }}
            >
              📹
            </button>

            <button
              type="button"
              className="call-ctrl-btn end-call"
              id="endCallBtn"
              aria-label="End call"
              title="End Call"
              onClick={() => endCall(true)}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#ea4335',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: 'bold',
                transition: 'all 0.15s ease',
                boxShadow: '0 4px 16px rgba(234, 67, 53, 0.4)',
              }}
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
};
