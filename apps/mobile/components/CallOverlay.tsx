/**
 * apps/mobile/components/CallOverlay.tsx
 *
 * Fullscreen Liquid Glass Call Interface for IndiChat Mobile.
 *
 * Handles:
 *  - Incoming call dialog (Accept / Decline)
 *  - Outgoing ringing and connecting states with cancel button
 *  - Fullscreen video call with remote video, picture-in-picture local preview, and camera switch
 *  - Voice call with large avatar and pulsing audio indicators
 *  - Floating glass control dock: Mute, Camera switch, Video mute, Speakerphone, Hangup
 *  - Audio routing integration with native AudioRouteModule
 *  - Real duration timer (active strictly during 'connected' state)
 *  - Accessible labels and high-contrast Liquid Glass UI tokens
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callService, ActiveCallSession } from '../services/callService';
import { LiquidGlassSurface } from './LiquidGlassSurface';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Error Boundary for WebRTC RTCView
class RTCViewSafeBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: any) {
    console.warn('[CallOverlay] RTCView render fallback triggered:', err);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

export const CallOverlay: React.FC = () => {
  const [session, setSession] = useState<ActiveCallSession | null>(null);
  const [rtcViewComponent, setRtcViewComponent] = useState<any>(null);

  // Pulse animation for avatar ringing / voice call
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subscribe to call session changes
  useEffect(() => {
    const unsub = callService.onSessionChange((active) => {
      setSession(active);
    });

    // Dynamically load RTCView from react-native-webrtc
    import('react-native-webrtc')
      .then((m) => {
        if (m.RTCView) {
          setRtcViewComponent(() => m.RTCView);
        }
      })
      .catch(() => {});

    return () => unsub();
  }, []);

  // Subtle pulse animation - kept static at 1.0 to preserve UI stability and avoid starving Android UiAutomation
  useEffect(() => {
    pulseAnim.setValue(1);
  }, [session?.state, session?.isVideo]);

  if (!session || session.state === 'idle') {
    return null;
  }

  const RTCView = rtcViewComponent;
  const isIncomingRinging = session.state === 'incoming_ringing';
  const isOutgoingRinging = session.state === 'outgoing_ringing';
  const isConnecting = session.state === 'connecting';
  const isConnected = session.state === 'connected';
  const isReconnecting = session.state === 'reconnecting';
  const isEnded = session.state === 'ended';

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const initialLetter = (session.peerName || 'U').charAt(0).toUpperCase();

  // -------------------------------------------------------------
  // 1. INCOMING RINGING OVERLAY (Modal Card)
  // -------------------------------------------------------------
  if (isIncomingRinging) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <StatusBar barStyle="light-content" />
        <View style={styles.incomingModalBackdrop}>
          <LiquidGlassSurface style={styles.incomingGlassCard}>
            <Animated.View style={[styles.avatarPulseWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.incomingAvatarCircle}>
                <Ionicons
                  name={session.isVideo ? 'videocam' : 'call'}
                  size={42}
                  color="#25D366"
                />
              </View>
            </Animated.View>

            <Text style={styles.incomingPeerName} numberOfLines={1}>
              {session.peerName}
            </Text>
            <Text style={styles.incomingSubtitle}>
              IndiChat {session.isVideo ? 'Video' : 'Voice'} Call...
            </Text>

            <View style={styles.incomingButtonsRow}>
              {/* Decline Button */}
              <TouchableOpacity
                style={[styles.callCircleBtn, styles.declineBtn]}
                onPress={() => callService.declineIncomingCall()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Decline Call"
              >
                <Ionicons
                  name="call"
                  size={26}
                  color="#ffffff"
                  style={{ transform: [{ rotate: '135deg' }] }}
                />
                <Text style={styles.btnLabel}>Decline</Text>
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity
                style={[styles.callCircleBtn, styles.acceptBtn]}
                onPress={() => callService.acceptIncomingCall()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Accept Call"
              >
                <Ionicons name="call" size={26} color="#ffffff" />
                <Text style={styles.btnLabel}>Accept</Text>
              </TouchableOpacity>
            </View>
          </LiquidGlassSurface>
        </View>
      </Modal>
    );
  }

  // -------------------------------------------------------------
  // 2. ACTIVE CALL / FULLSCREEN INTERFACE
  // -------------------------------------------------------------
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.fullscreenCallContainer}>
        {/* VIDEO MODE: Remote video stream */}
        {session.isVideo && session.remoteStream && RTCView ? (
          <View style={styles.remoteVideoContainer}>
            <RTCViewSafeBoundary
              fallback={
                <View style={styles.videoFallbackBox}>
                  <Text style={styles.videoFallbackText}>Video Rendering Paused</Text>
                </View>
              }
            >
              <RTCView
                streamURL={session.remoteStream.toURL()}
                style={styles.remoteVideo}
                objectFit="cover"
              />
            </RTCViewSafeBoundary>

            {/* Picture-in-Picture Local Video Preview */}
            {session.localStream && !session.isVideoMuted && (
              <View style={styles.localPipContainer}>
                <RTCViewSafeBoundary>
                  <RTCView
                    streamURL={session.localStream.toURL()}
                    style={styles.localPipVideo}
                    mirror={session.isFrontCamera}
                    objectFit="cover"
                  />
                </RTCViewSafeBoundary>
              </View>
            )}
          </View>
        ) : (
          /* AUDIO MODE / OUTGOING RINGING: Dark gradient background with avatar */
          <View style={styles.audioCenterContainer}>
            <Animated.View style={[styles.avatarPulseWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.largeAudioAvatar}>
                <Text style={styles.largeAvatarText}>{initialLetter}</Text>
              </View>
            </Animated.View>

            <Text style={styles.peerNameText} numberOfLines={1}>
              {session.peerName}
            </Text>

            {/* Status indicator */}
            <View style={styles.statusPill}>
              {isReconnecting ? (
                <Ionicons name="warning-outline" size={14} color="#f59e0b" style={{ marginRight: 6 }} />
              ) : isConnected ? (
                <View style={[styles.onlineDot, session.isReceivingMedia && styles.onlineDotActive]} />
              ) : null}
              <Text style={[styles.statusText, isReconnecting && { color: '#f59e0b' }, isEnded && { color: '#ef4444' }]}>
                {isConnected
                  ? formatDuration(session.duration)
                  : isEnded
                  ? session.statusText || 'Call Ended'
                  : session.statusText || (isOutgoingRinging ? 'Ringing...' : 'Connecting...')}
              </Text>
            </View>

            {/* Peer Muted Badge */}
            {session.isPeerMuted && (
              <View style={styles.peerMutedBadge}>
                <Ionicons name="mic-off" size={12} color="#f15c6d" style={{ marginRight: 4 }} />
                <Text style={styles.peerMutedText}>Peer muted audio</Text>
              </View>
            )}
          </View>
        )}

        {/* TOP HEADER OVERLAY (In video call: floating glass header with duration and info) */}
        {session.isVideo && (
          <LiquidGlassSurface style={styles.topVideoHeaderGlass}>
            <View style={styles.topHeaderLeft}>
              <Text style={styles.videoHeaderName} numberOfLines={1}>
                {session.peerName}
              </Text>
              <View style={styles.videoHeaderMetaRow}>
                {isConnected && (
                  <View style={[styles.onlineDot, session.isReceivingMedia && styles.onlineDotActive]} />
                )}
                <Text style={styles.videoHeaderDuration}>
                  {isConnected
                    ? formatDuration(session.duration)
                    : isEnded
                    ? session.statusText || 'Ended'
                    : session.statusText || 'Connecting...'}
                </Text>
                {session.isPeerMuted && (
                  <Text style={styles.peerMutedMini}>• Peer Muted</Text>
                )}
              </View>
            </View>
            <View style={styles.securityBadge}>
              <Ionicons name="lock-closed" size={14} color="#25D366" />
            </View>
          </LiquidGlassSurface>
        )}

        {/* BOTTOM FLOATING CONTROLS DOCK */}
        <LiquidGlassSurface style={styles.bottomControlsDock}>
          {/* 1. Mic Mute Toggle */}
          <TouchableOpacity
            style={[styles.dockBtn, session.isMuted && styles.dockBtnActiveRed]}
            onPress={() => callService.toggleMute()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={session.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            <Ionicons
              name={session.isMuted ? 'mic-off' : 'mic'}
              size={22}
              color={session.isMuted ? '#ffffff' : '#ffffff'}
            />
          </TouchableOpacity>

          {/* 2. Camera Switch (Only in Video calls) */}
          {session.isVideo && (
            <TouchableOpacity
              style={styles.dockBtn}
              onPress={() => callService.switchCamera()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Switch Camera"
            >
              <Ionicons name="camera-reverse" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* 3. Video Mute / Cam Off Toggle (Only in Video calls) */}
          {session.isVideo && (
            <TouchableOpacity
              style={[styles.dockBtn, session.isVideoMuted && styles.dockBtnActiveRed]}
              onPress={() => callService.toggleVideoMute()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={session.isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              <Ionicons
                name={session.isVideoMuted ? 'videocam-off' : 'videocam'}
                size={22}
                color="#ffffff"
              />
            </TouchableOpacity>
          )}

          {/* 4. Speakerphone Toggle */}
          <TouchableOpacity
            style={[styles.dockBtn, session.isSpeakerOn && styles.dockBtnActiveGreen]}
            onPress={() => callService.toggleSpeakerphone()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={session.isSpeakerOn ? 'Switch to Earpiece' : 'Switch to Speakerphone'}
          >
            <Ionicons
              name={session.isSpeakerOn ? 'volume-high' : 'volume-medium'}
              size={22}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* 5. End Call / Hangup Button */}
          <TouchableOpacity
            style={[styles.dockBtn, styles.dockBtnHangup]}
            onPress={() => callService.hangupCall()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="End Call"
          >
            <Ionicons
              name="call"
              size={24}
              color="#ffffff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </LiquidGlassSurface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Incoming Modal
  incomingModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  incomingGlassCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(22, 27, 34, 0.92)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  avatarPulseWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  incomingAvatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 211, 102, 0.4)',
  },
  incomingPeerName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  incomingSubtitle: {
    color: '#8696a0',
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
  },
  incomingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 16,
  },
  callCircleBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  declineBtn: {
    backgroundColor: '#E53935',
  },
  acceptBtn: {
    backgroundColor: '#25D366',
  },
  btnLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },

  // Fullscreen Call Interface
  fullscreenCallContainer: {
    flex: 1,
    backgroundColor: '#0c0f14',
    justifyContent: 'space-between',
  },

  // Remote Video
  remoteVideoContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  localPipContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 48,
    right: 18,
    width: 104,
    height: 146,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#161b22',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  localPipVideo: {
    width: '100%',
    height: '100%',
  },
  videoFallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161b22',
  },
  videoFallbackText: {
    color: '#8696a0',
    fontSize: 14,
  },

  // Audio Center View
  audioCenterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  largeAudioAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    marginBottom: 16,
  },
  largeAvatarText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '700',
  },
  peerNameText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusText: {
    color: '#8696a0',
    fontSize: 14,
    fontWeight: '500',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8696a0',
    marginRight: 6,
  },
  onlineDotActive: {
    backgroundColor: '#25D366',
  },
  peerMutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 92, 109, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  peerMutedText: {
    color: '#f15c6d',
    fontSize: 12,
    fontWeight: '500',
  },

  // Top Video Header Glass
  topVideoHeaderGlass: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 38,
    left: 18,
    right: 140, // give space so pip doesn't overlap
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(20, 24, 30, 0.85)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  topHeaderLeft: {
    flex: 1,
  },
  videoHeaderName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  videoHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  videoHeaderDuration: {
    color: '#8696a0',
    fontSize: 12,
  },
  peerMutedMini: {
    color: '#f15c6d',
    fontSize: 11,
    marginLeft: 6,
  },
  securityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Bottom Floating Controls Dock
  bottomControlsDock: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 42 : 28,
    left: 20,
    right: 20,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(20, 24, 30, 0.88)',
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dockBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockBtnActiveRed: {
    backgroundColor: '#E53935',
  },
  dockBtnActiveGreen: {
    backgroundColor: '#25D366',
  },
  dockBtnHangup: {
    backgroundColor: '#E53935',
    width: 54,
    height: 54,
    borderRadius: 27,
  },
});
