/** Native methods used by react-native-webrtc 155, on both Android and iOS. */
export function hasNativeWebRTC(binding: any): boolean {
  return typeof binding?.getUserMedia === 'function' &&
    typeof binding?.peerConnectionInit === 'function';
}

export async function loadNativeRTCView(
  binding: any,
  load: () => Promise<{ RTCView?: any }> = () => import('react-native-webrtc'),
): Promise<any | null> {
  if (!hasNativeWebRTC(binding)) return null;
  try {
    return (await load()).RTCView ?? null;
  } catch (error) {
    console.warn('[CallOverlay] Native video view unavailable:', error);
    return null;
  }
}

/** Returns cleanup immediately, before the native import resolves. */
export function observeNativeRTCView(
  binding: any,
  publish: (view: any) => void,
  load?: () => Promise<{ RTCView?: any }>,
): () => void {
  let mounted = true;
  loadNativeRTCView(binding, load).then(view => {
    if (mounted && view) publish(view);
  });
  return () => { mounted = false; };
}

/** RTCView resolves a native video track when its stream URL is assigned.
 * Mounting against an empty stream can leave its surface permanently black.
 */
export function renderableVideoURL(stream: any): string | null {
  return stream?.getVideoTracks?.().some((track: any) => track.readyState !== 'ended')
    ? stream.toURL()
    : null;
}
