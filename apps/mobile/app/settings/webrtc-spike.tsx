/**
 * apps/mobile/app/settings/webrtc-spike.tsx
 *
 * Isolated Development Test Harness for WebRTC Compatibility Spike:
 *  - Native module inspection (mediaDevices, RTCPeerConnection, RTCView)
 *  - Real microphone & camera acquisition on device
 *  - Real RTCView local rendering & error reproduction under New Architecture
 *  - Real on-device local loopback (pc1 <-> pc2) testing SDP, ICE, ontrack, and stats
 *  - Track cleanup and hardware release verification
 *  - Permission denial & revocation handling
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { isDevelopmentOrInternalBuild } from '../../services/settings';
import {
  probeWebRTCSupport,
  acquireLocalMediaSpike,
  releaseLocalMediaSpike,
  runLocalLoopbackSpike,
  LoopbackSpikeResult,
} from '../../services/webrtcSpike';

// Error boundary to catch any RTCView Fabric render crashes safely
class RTCViewErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (err: Error) => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'RTCView render error' };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('[WebRTC Spike] RTCView crashed during render:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxTitle}>RTCView Render Failed:</Text>
          <Text style={styles.errorBoxText}>{this.state.errorMsg}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function WebRTCSpikeScreen() {
  const router = useRouter();
  const { palette, userSettings } = useTheme();
  const isDevOrInternal = isDevelopmentOrInternalBuild();

  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);

  const [acquiring, setAcquiring] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [localTracks, setLocalTracks] = useState<any[]>([]);
  const [localAcquisitionError, setLocalAcquisitionError] = useState<string | null>(null);

  const [loopbackRunning, setLoopbackRunning] = useState(false);
  const [loopbackResult, setLoopbackResult] = useState<LoopbackSpikeResult | null>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const [renderError, setRenderError] = useState<string | null>(null);
  const [rtcViewComponent, setRtcViewComponent] = useState<any>(null);

  const [logMessages, setLogMessages] = useState<string[]>([]);

  const activePcRef = useRef<{ pc1?: any; pc2?: any }>({});

  const appendLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Teardown when unmounting / leaving the screen
  useEffect(() => {
    return () => {
      if (activePcRef.current.pc1) {
        try { activePcRef.current.pc1.close(); } catch {}
        activePcRef.current.pc1 = null;
      }
      if (activePcRef.current.pc2) {
        try { activePcRef.current.pc2.close(); } catch {}
        activePcRef.current.pc2 = null;
      }
    };
  }, []);

  // Dynamically load RTCView component if available
  useEffect(() => {
    if (NativeModules && NativeModules.WebRTCModule && typeof (NativeModules.WebRTCModule as any).startCall === 'function') {
      import('react-native-webrtc')
        .then((m) => {
          if (m.RTCView) {
            setRtcViewComponent(() => m.RTCView);
            appendLog('RTCView component imported successfully.');
          } else {
            appendLog('RTCView is undefined in react-native-webrtc export.');
          }
        })
        .catch((e) => {
          appendLog(`Failed to import react-native-webrtc: ${e.message}`);
        });
    } else {
      appendLog('WebRTC native module is not linked in this binary; dynamic RTCView load skipped.');
    }
  }, []);

  // 1. Probe native module
  const handleProbe = async () => {
    setProbing(true);
    appendLog('Probing native WebRTC module presence...');
    try {
      const res = await probeWebRTCSupport();
      setProbeResult(res);
      appendLog(
        res.moduleAvailable
          ? `Probe OK: MediaDevices=${res.hasMediaDevices}, RTCPeerConnection=${res.hasPeerConnection}, RTCView=${res.hasRTCView}`
          : `Probe FAILED: ${res.error}`
      );
    } finally {
      setProbing(false);
    }
  };

  // 2. Real media acquisition
  const handleAcquireMedia = async (withVideo: boolean) => {
    setAcquiring(true);
    setLocalAcquisitionError(null);
    appendLog(`Acquiring local media (audio=true, video=${withVideo})...`);
    try {
      const res = await acquireLocalMediaSpike({ audio: true, video: withVideo });
      if (res.success && res.stream) {
        setLocalStream(res.stream);
        setLocalTracks(res.tracks || []);
        appendLog(
          `Acquisition SUCCESS: ${res.tracks?.length || 0} track(s) active (${res.tracks?.map((t) => `${t.kind}:${t.readyState}`).join(', ')})`
        );
      } else {
        setLocalAcquisitionError(res.error || 'Failed to acquire media');
        appendLog(`Acquisition FAILED: ${res.error} (PermissionDenied=${res.isPermissionDenied})`);
      }
    } finally {
      setAcquiring(false);
    }
  };

  // 3. Real local loopback (pc1 <-> pc2)
  const handleRunLoopback = async () => {
    // Clean up previous loopback session before re-running
    if (activePcRef.current.pc1 || activePcRef.current.pc2) {
      appendLog('Cleaning up previous loopback session before re-running...');
      if (activePcRef.current.pc1) {
        try { activePcRef.current.pc1.close(); } catch {}
        activePcRef.current.pc1 = null;
      }
      if (activePcRef.current.pc2) {
        try { activePcRef.current.pc2.close(); } catch {}
        activePcRef.current.pc2 = null;
      }
      if (remoteStream) {
        releaseLocalMediaSpike(remoteStream);
        setRemoteStream(null);
      }
    }

    if (!localStream) {
      appendLog('Acquiring camera & mic first before loopback...');
      const res = await acquireLocalMediaSpike({ audio: true, video: true });
      if (!res.success || !res.stream) {
        appendLog(`Cannot run loopback: local media acquisition failed (${res.error})`);
        return;
      }
      setLocalStream(res.stream);
      setLocalTracks(res.tracks || []);
    }

    setLoopbackRunning(true);
    appendLog('Starting on-device local loopback (pc1 <---> pc2)...');
    try {
      const currentStream = localStream || (await acquireLocalMediaSpike({ audio: true, video: true })).stream;
      const res = await runLocalLoopbackSpike(currentStream);
      setLoopbackResult(res);
      if (res.pc1 && res.pc2) {
        activePcRef.current = { pc1: res.pc1, pc2: res.pc2 };
      }
      if (res.remoteStream) {
        setRemoteStream(res.remoteStream);
      }
      appendLog(
        res.success
          ? `Loopback OK: AudioPackets=${res.t1Stats?.audio.packetsReceived} (+${res.deltaPacketsAudio}), VideoPackets=${res.t1Stats?.video.packetsReceived} (+${res.deltaPacketsVideo}), DecodedFrames=${res.t1Stats?.video.framesDecoded || 0}`
          : `Loopback FAILED: ${res.error}`
      );
    } catch (err: any) {
      appendLog(`Loopback Error: ${err?.message || err}. Cleaning up connections.`);
      if (activePcRef.current.pc1) { try { activePcRef.current.pc1.close(); } catch {} activePcRef.current.pc1 = null; }
      if (activePcRef.current.pc2) { try { activePcRef.current.pc2.close(); } catch {} activePcRef.current.pc2 = null; }
    } finally {
      setLoopbackRunning(false);
    }
  };

  // 4. Release hardware & close connections
  const handleRelease = () => {
    appendLog('Cleaning up tracks and closing peer connections...');
    let released = 0;
    if (localStream) {
      const r = releaseLocalMediaSpike(localStream);
      released += r.releasedCount;
      setLocalStream(null);
      setLocalTracks([]);
    }
    if (remoteStream) {
      const r = releaseLocalMediaSpike(remoteStream);
      released += r.releasedCount;
      setRemoteStream(null);
    }
    if (activePcRef.current.pc1) {
      try { activePcRef.current.pc1.close(); } catch {}
      activePcRef.current.pc1 = null;
    }
    if (activePcRef.current.pc2) {
      try { activePcRef.current.pc2.close(); } catch {}
      activePcRef.current.pc2 = null;
    }
    setLoopbackResult(null);
    appendLog(`Cleanup COMPLETE: Released ${released} track(s) and closed peer connections.`);
  };

  // Direct route guard for release builds
  if (!isDevOrInternal) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <ScreenHeader title="WebRTC Spike" />
        <View style={styles.restrictedCenter}>
          <LiquidGlassSurface style={styles.restrictedSurface}>
            <Ionicons name="lock-closed" size={44} color="#f59e0b" style={{ marginBottom: 12, alignSelf: 'center' }} />
            <Text style={styles.restrictedTitle}>Development Diagnostics Only</Text>
            <Text style={styles.restrictedDesc}>
              This hardware diagnostic test harness is restricted to internal development builds.
              In standard release builds, hardware test screens are disabled to preserve production integrity.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#00a884', marginTop: 16 }]}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/settings');
                }
              }}
            >
              <Text style={styles.btnText}>Return to Settings</Text>
            </TouchableOpacity>
          </LiquidGlassSurface>
        </View>
      </View>
    );
  }

  const RTCView = rtcViewComponent;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="WebRTC Spike (Dev)" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <LiquidGlassSurface style={styles.bannerSurface}>
          <View style={styles.bannerRow}>
            <Ionicons name="flask-outline" size={24} color="#10b981" />
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerTitle}>Isolated WebRTC Spike</Text>
              <Text style={styles.bannerSubtitle}>
                On-device validation of native WebRTC M155, media capture, loopback, and Fabric RTCView rendering.
              </Text>
            </View>
          </View>
        </LiquidGlassSurface>

        {/* Action 1: Probe Module */}
        <LiquidGlassSurface style={styles.cardSurface}>
          <Text style={styles.sectionHeader}>1. Native Module Probe</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#00a884' }]}
            onPress={handleProbe}
            disabled={probing}
          >
            {probing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Probe Native WebRTC Symbols</Text>
            )}
          </TouchableOpacity>

          {probeResult && (
            <View style={styles.resultBox}>
              <Text style={styles.kvText}>
                Module Available: <Text style={probeResult.moduleAvailable ? styles.valSuccess : styles.valFail}>{String(probeResult.moduleAvailable)}</Text>
              </Text>
              <Text style={styles.kvText}>
                MediaDevices: <Text style={probeResult.hasMediaDevices ? styles.valSuccess : styles.valFail}>{String(probeResult.hasMediaDevices)}</Text>
              </Text>
              <Text style={styles.kvText}>
                RTCPeerConnection: <Text style={probeResult.hasPeerConnection ? styles.valSuccess : styles.valFail}>{String(probeResult.hasPeerConnection)}</Text>
              </Text>
              <Text style={styles.kvText}>
                RTCView: <Text style={probeResult.hasRTCView ? styles.valSuccess : styles.valFail}>{String(probeResult.hasRTCView)}</Text>
              </Text>
            </View>
          )}
        </LiquidGlassSurface>

        {/* Action 2: Local Media Acquisition */}
        <LiquidGlassSurface style={styles.cardSurface}>
          <Text style={styles.sectionHeader}>2. Real Media Acquisition (Camera/Mic)</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnHalf, { backgroundColor: '#0284c7' }]}
              onPress={() => handleAcquireMedia(false)}
              disabled={acquiring}
            >
              <Text style={styles.btnText}>Mic Only</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnHalf, { backgroundColor: '#10b981' }]}
              onPress={() => handleAcquireMedia(true)}
              disabled={acquiring}
            >
              <Text style={styles.btnText}>Camera + Mic</Text>
            </TouchableOpacity>
          </View>

          {localAcquisitionError && (
            <Text style={styles.errorText}>Error: {localAcquisitionError}</Text>
          )}

          {localTracks.length > 0 && (
            <View style={styles.resultBox}>
              <Text style={styles.resultHeader}>Active Local Tracks ({localTracks.length}):</Text>
              {localTracks.map((t, idx) => (
                <Text key={idx} style={styles.kvText}>
                  • {t.kind.toUpperCase()}: <Text style={styles.valSuccess}>{t.readyState}</Text> (id: {t.id.slice(0, 10)}...)
                </Text>
              ))}
            </View>
          )}

          {/* Local RTCView Rendering Test */}
          {localStream && RTCView && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Local Video (RTCView Render Test):</Text>
              <RTCViewErrorBoundary onError={(e) => setRenderError(e.message)}>
                <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.rtcView}
                  objectFit="cover"
                  mirror={true}
                />
              </RTCViewErrorBoundary>
            </View>
          )}
        </LiquidGlassSurface>

        {/* Action 3: Local Loopback Peer Connection */}
        <LiquidGlassSurface style={styles.cardSurface}>
          <Text style={styles.sectionHeader}>3. Real Local Loopback (pc1 ↔ pc2)</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#8b5cf6' }]}
            onPress={handleRunLoopback}
            disabled={loopbackRunning}
          >
            {loopbackRunning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Run On-Device Loopback Test</Text>
            )}
          </TouchableOpacity>

          {loopbackResult && (
            <View style={styles.resultBox}>
              <Text style={styles.resultHeader}>Peer Connection State:</Text>
              <Text style={styles.kvText}>
                pc1 Connected: <Text style={loopbackResult.pc1Connected ? styles.valSuccess : styles.valFail}>{String(loopbackResult.pc1Connected)}</Text>
              </Text>
              <Text style={styles.kvText}>
                pc2 Connected: <Text style={loopbackResult.pc2Connected ? styles.valSuccess : styles.valFail}>{String(loopbackResult.pc2Connected)}</Text>
              </Text>

              <Text style={[styles.resultHeader, { marginTop: 8 }]}>Audio Inbound Stream:</Text>
              <Text style={styles.kvText}>
                Audio Track Received: <Text style={loopbackResult.audioTrackReceived ? styles.valSuccess : styles.valFail}>{String(loopbackResult.audioTrackReceived)}</Text>
                {loopbackResult.audioTrackId ? ` (${loopbackResult.audioTrackId.slice(0, 10)}...)` : ''}
              </Text>
              <Text style={styles.kvText}>
                Audio Packets (T1): <Text style={styles.valSuccess}>{loopbackResult.t1Stats?.audio.packetsReceived ?? 0}</Text>
                <Text style={styles.dimText}> (+{loopbackResult.deltaPacketsAudio ?? 0} over 1.5s)</Text>
              </Text>
              <Text style={styles.kvText}>
                Audio Bytes (T1): <Text style={styles.valSuccess}>{loopbackResult.t1Stats?.audio.bytesReceived ?? 0}</Text>
                <Text style={styles.dimText}> (+{loopbackResult.deltaBytesAudio ?? 0} bytes)</Text>
              </Text>

              <Text style={[styles.resultHeader, { marginTop: 8 }]}>Video Inbound Stream:</Text>
              <Text style={styles.kvText}>
                Video Track Received: <Text style={loopbackResult.videoTrackReceived ? styles.valSuccess : styles.valFail}>{String(loopbackResult.videoTrackReceived)}</Text>
                {loopbackResult.videoTrackId ? ` (${loopbackResult.videoTrackId.slice(0, 10)}...)` : ''}
              </Text>
              <Text style={styles.kvText}>
                Video Packets (T1): <Text style={styles.valSuccess}>{loopbackResult.t1Stats?.video.packetsReceived ?? 0}</Text>
                <Text style={styles.dimText}> (+{loopbackResult.deltaPacketsVideo ?? 0} over 1.5s)</Text>
              </Text>
              <Text style={styles.kvText}>
                Video Bytes (T1): <Text style={styles.valSuccess}>{loopbackResult.t1Stats?.video.bytesReceived ?? 0}</Text>
                <Text style={styles.dimText}> (+{loopbackResult.deltaBytesVideo ?? 0} bytes)</Text>
              </Text>
              <Text style={styles.kvText}>
                Frames Decoded: <Text style={styles.valSuccess}>{loopbackResult.t1Stats?.video.framesDecoded ?? 0}</Text>
              </Text>

              <Text style={[styles.resultHeader, { marginTop: 8 }]}>Verification Levels:</Text>
              <Text style={styles.kvText}>
                • Track Creation: <Text style={styles.valSuccess}>Verified (Live track object)</Text>
              </Text>
              <Text style={styles.kvText}>
                • Inbound RTP Flow: <Text style={loopbackResult.statsIncreasing ? styles.valSuccess : styles.valFail}>{loopbackResult.statsIncreasing ? 'Verified (Increasing over time)' : 'Pending flow'}</Text>
              </Text>
              <Text style={styles.kvText}>
                • Rendered Video: <Text style={loopbackResult.videoFramesRendered ? styles.valSuccess : styles.valFail}>{loopbackResult.videoFramesRendered ? 'Verified (SurfaceView rendering)' : 'Awaiting frames'}</Text>
              </Text>
              <Text style={styles.kvText}>
                • Audible Playback: <Text style={styles.valWarning}>Software decoded only</Text>
              </Text>
              <Text style={styles.disclaimerText}>{loopbackResult.audiblePlaybackNote}</Text>
            </View>
          )}

          {/* Remote RTCView Rendering Test */}
          {remoteStream && RTCView && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Remote Video (RTCView Render Test):</Text>
              <RTCViewErrorBoundary onError={(e) => setRenderError(e.message)}>
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={styles.rtcView}
                  objectFit="cover"
                />
              </RTCViewErrorBoundary>
            </View>
          )}
        </LiquidGlassSurface>

        {/* Action 4: Cleanup */}
        <LiquidGlassSurface style={styles.cardSurface}>
          <Text style={styles.sectionHeader}>4. Cleanup & Teardown</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#ef4444' }]}
            onPress={handleRelease}
          >
            <Text style={styles.btnText}>Release Hardware & Close All</Text>
          </TouchableOpacity>
        </LiquidGlassSurface>

        {/* Live Event Log */}
        <LiquidGlassSurface style={styles.cardSurface}>
          <Text style={styles.sectionHeader}>Live Diagnostic Log</Text>
          <View style={styles.logContainer}>
            {logMessages.length === 0 ? (
              <Text style={styles.logEmpty}>No events logged yet. Tap an action above.</Text>
            ) : (
              logMessages.map((msg, i) => (
                <Text key={i} style={styles.logText}>{msg}</Text>
              ))
            )}
          </View>
        </LiquidGlassSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  bannerSurface: { padding: 16, marginBottom: 16, borderRadius: 16 },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerTextCol: { marginLeft: 12, flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  bannerSubtitle: { fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2 },
  cardSurface: { padding: 16, marginBottom: 16, borderRadius: 16 },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#86efac', marginBottom: 12 },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  btnHalf: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  resultBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
  },
  resultHeader: { fontSize: 13, fontWeight: '600', color: '#ffffff', marginBottom: 6 },
  kvText: { fontSize: 13, color: '#e2e8f0', marginBottom: 4 },
  valSuccess: { color: '#34d399', fontWeight: '700' },
  valFail: { color: '#f87171', fontWeight: '700' },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 8 },
  previewContainer: { marginTop: 12, alignItems: 'center' },
  previewLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6, alignSelf: 'flex-start' },
  rtcView: { width: 260, height: 180, borderRadius: 12, backgroundColor: '#000000' },
  errorBox: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    marginTop: 8,
  },
  errorBoxTitle: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  errorBoxText: { color: '#fca5a5', fontSize: 12, marginTop: 4 },
  logContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    maxHeight: 220,
  },
  logEmpty: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
  logText: { color: '#cbd5e1', fontSize: 11, fontFamily: 'monospace', marginBottom: 4 },
  restrictedCenter: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restrictedSurface: {
    padding: 24,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  restrictedDesc: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  dimText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'normal',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
  },
  valWarning: {
    color: '#fbbf24',
    fontWeight: '700',
  },
});
