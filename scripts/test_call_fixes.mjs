import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
register(pathToFileURL(path.resolve('scripts/test-resolver.mjs')));
const { audioRouteService } = await import('../apps/mobile/services/audioRoute.ts');
const { NativeModules, Platform } = await import('./mocks/external-mock.mjs');
const { callService } = await import('../apps/mobile/services/callService.ts');
test('unsupported routing never reports success', async () => {
  const native = NativeModules.IndiChatAudioRoute;
  delete NativeModules.IndiChatAudioRoute;
  try { assert.equal((await audioRouteService.setSpeakerphoneOn(true)).success, false); }
  finally { NativeModules.IndiChatAudioRoute = native; }
});
test('failed routing preserves the indicator', async () => {
  callService.currentSession = { state: 'connected', isSpeakerOn: false };
  const original = audioRouteService.setSpeakerphoneOn;
  audioRouteService.setSpeakerphoneOn = async () => ({ success: false, isSpeaker: true });
  try { await callService.toggleSpeakerphone(); assert.equal(callService.getSession().isSpeakerOn, false); }
  finally { audioRouteService.setSpeakerphoneOn = original; callService.currentSession = null; }
});
for (const replacement of [null, { state: 'connected', isSpeakerOn: false }]) {
  test(`pending routing ignores ${replacement ? 'replacement' : 'teardown'}`, async () => {
    callService.currentSession = { state: 'connected', isSpeakerOn: false };
    const original = audioRouteService.setSpeakerphoneOn;
    let complete;
    audioRouteService.setSpeakerphoneOn = () => new Promise(resolve => { complete = resolve; });
    try {
      const pending = callService.toggleSpeakerphone();
      callService.currentSession = replacement;
      complete({ success: true, isSpeaker: true });
      await pending;
      assert.equal(callService.getSession()?.isSpeakerOn ?? false, false);
    } finally { audioRouteService.setSpeakerphoneOn = original; callService.currentSession = null; }
  });
}
test('successful routing uses actual returned state', async () => {
  callService.currentSession = { state: 'connected', isSpeakerOn: false };
  const original = audioRouteService.setSpeakerphoneOn;
  audioRouteService.setSpeakerphoneOn = async () => ({ success: true, isSpeaker: false });
  try { await callService.toggleSpeakerphone(); assert.equal(callService.getSession().isSpeakerOn, false); }
  finally { audioRouteService.setSpeakerphoneOn = original; callService.currentSession = null; }
});
test('native routing handles rejection and returned route', async () => {
  const native = NativeModules.IndiChatAudioRoute;
  const original = native.setSpeakerphoneOn;
  try {
    native.setSpeakerphoneOn = async () => { throw new Error('route rejected'); };
    assert.equal((await audioRouteService.setSpeakerphoneOn(true)).success, false);
    native.setSpeakerphoneOn = async () => ({ isSpeakerphoneOn: false, currentRoute: 'bluetooth' });
    assert.deepEqual(await audioRouteService.setSpeakerphoneOn(true), { success: true, isSpeaker: false, currentRoute: 'bluetooth' });
  } finally { native.setSpeakerphoneOn = original; }
});
test('supported WebRTC bindings load RTCView; missing bindings do not load', async () => {
  const { hasNativeWebRTC, loadNativeRTCView } = await import('../apps/mobile/services/nativeWebRTC.ts');
  const supported = { getUserMedia() {}, peerConnectionInit() {} };
  assert.equal(hasNativeWebRTC(supported), true);
  for (const missing of [null, undefined, {}, { startCall() {} }]) assert.equal(hasNativeWebRTC(missing), false);
  const view = () => null;
  let loaded = 0;
  assert.equal(await loadNativeRTCView(supported, async () => { loaded++; return { RTCView: view }; }), view);
  assert.equal(await loadNativeRTCView(null, async () => { loaded++; return { RTCView: view }; }), null);
  assert.equal(loaded, 1);
  assert.equal(await loadNativeRTCView(supported, async () => { throw Error('missing view'); }), null);
});
test('navigation honors resolved motion immediately, including preview and system', async () => {
  const { navigationAnimation } = await import('../apps/mobile/theme/navigation.ts');
  const { resolveEffectiveTheme } = await import('../apps/mobile/theme/resolveTheme.ts');
  const settings = { appearanceMode: 'dark', blurRadius: 20, reducedMotion: 'system' };
  const animation = (preview, system) => navigationAnimation(resolveEffectiveTheme(settings, preview, 'dark', false, system).isReducedMotion);
  assert.equal(animation(null, false), 'slide_from_right');
  assert.equal(animation(null, true), 'none');
  assert.equal(animation({ reducedMotion: 'off' }, true), 'slide_from_right');
  assert.equal(animation({ reducedMotion: 'on' }, false), 'none');
});
test('RTCView loading does not publish after unmount', async () => {
  const { observeNativeRTCView } = await import('../apps/mobile/services/nativeWebRTC.ts');
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  let published = 0;
  const cleanup = observeNativeRTCView({ getUserMedia() {}, peerConnectionInit() {} }, () => { published++; }, () => pending);
  cleanup();
  complete({ RTCView: () => null });
  await pending;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(published, 0);
});
test('teardown invalidates routing before native audio cleanup resolves', async () => {
  callService.currentSession = { state: 'connected', connectedAt: Date.now(), isSpeakerOn: false };
  const session = callService.currentSession;
  const set = audioRouteService.setSpeakerphoneOn;
  const stop = audioRouteService.stopCallAudio;
  let routeDone, stopDone;
  audioRouteService.setSpeakerphoneOn = () => new Promise(resolve => { routeDone = resolve; });
  audioRouteService.stopCallAudio = () => new Promise(resolve => { stopDone = resolve; });
  try {
    const routing = callService.toggleSpeakerphone();
    const ending = callService.terminateCall('user_ended', 'ended', false);
    routeDone({ success: true, isSpeaker: true });
    await routing;
    assert.equal(session.isSpeakerOn, false);
    stopDone(true);
    await ending;
  } finally { audioRouteService.setSpeakerphoneOn = set; audioRouteService.stopCallAudio = stop; callService.currentSession = null; }
});
test('routing startup and teardown report unsupported and native failure honestly', async () => {
  const native = NativeModules.IndiChatAudioRoute;
  const start = native.startCallAudio;
  const stop = native.stopCallAudio;
  const setSpeaker = native.setSpeakerphoneOn;
  try {
    delete NativeModules.IndiChatAudioRoute;
    assert.deepEqual(await audioRouteService.startCallAudio(true), { success: false, currentRoute: 'unknown' });
    assert.equal(await audioRouteService.stopCallAudio(), false);
    NativeModules.IndiChatAudioRoute = native;
    Platform.OS = 'ios';
    assert.equal(audioRouteService.isAvailable, true);
    assert.equal((await audioRouteService.startCallAudio(true)).currentRoute, 'speaker');
    native.startCallAudio = async () => ({ success: false, currentRoute: 'speaker' });
    assert.equal((await audioRouteService.startCallAudio(true)).success, false);
    native.stopCallAudio = async () => false;
    assert.equal(await audioRouteService.stopCallAudio(), false);
    native.stopCallAudio = async () => { throw Error('stop failed'); };
    assert.equal(await audioRouteService.stopCallAudio(), false);
    native.setSpeakerphoneOn = async () => ({ success: false, isSpeakerphoneOn: true, currentRoute: 'speaker' });
    assert.equal((await audioRouteService.setSpeakerphoneOn(true)).success, false);
  } finally {
    native.startCallAudio = start;
    native.stopCallAudio = stop;
    native.setSpeakerphoneOn = setSpeaker;
    NativeModules.IndiChatAudioRoute = native;
    Platform.OS = 'android';
  }
});
test('malformed routing result cannot become success', async () => {
  const native = NativeModules.IndiChatAudioRoute;
  const set = native.setSpeakerphoneOn;
  const start = native.startCallAudio;
  try {
    native.setSpeakerphoneOn = async () => ({});
    assert.equal((await audioRouteService.setSpeakerphoneOn(true)).success, false);
    native.startCallAudio = async () => { throw Error('initialization failed'); };
    assert.equal((await audioRouteService.startCallAudio(true)).success, false);
  } finally { native.setSpeakerphoneOn = set; native.startCallAudio = start; }
});
test('route inspection reports native output and unknown on failure or absence', async () => {
  const native = NativeModules.IndiChatAudioRoute;
  const get = native.getAudioRoute;
  try {
    native.getAudioRoute = async () => ({ route: 'speaker', isSpeaker: true });
    assert.deepEqual(await audioRouteService.getAudioRoute(), { route: 'speaker', isSpeaker: true });
    assert.equal(await audioRouteService.isSpeakerphoneOn(), true);
    native.getAudioRoute = async () => { throw Error('inspection failed'); };
    assert.deepEqual(await audioRouteService.getAudioRoute(), { route: 'unknown', isSpeaker: false });
    delete NativeModules.IndiChatAudioRoute;
    assert.deepEqual(await audioRouteService.getAudioRoute(), { route: 'unknown', isSpeaker: false });
  } finally { NativeModules.IndiChatAudioRoute = native; native.getAudioRoute = get; }
});
test('teardown releases captured media before awaiting routing and cannot close a replacement peer', async () => {
  let audioDone;
  const stopAudio = audioRouteService.stopCallAudio;
  audioRouteService.stopCallAudio = () => new Promise(resolve => { audioDone = resolve; });
  const track = { stopped: false, stop() { this.stopped = true; } };
  const oldPeer = { closed: false, close() { this.closed = true; } };
  const newPeer = { closed: false, close() { this.closed = true; } };
  callService.currentSession = { state: 'outgoing_ringing', isSpeakerOn: false, localStream: { getTracks: () => [track] }, duration: 0, peerName: 'Regression', peerId: 'peer' };
  callService.pc = oldPeer;
  try {
    const ending = callService.terminateCall('caller_cancelled', 'cancelled', false);
    const releasedBeforeRouting = track.stopped && oldPeer.closed;
    const replacement = { state: 'connected', isSpeakerOn: false };
    callService.currentSession = replacement;
    callService.pc = newPeer;
    audioDone(true);
    await ending;
    assert.equal(releasedBeforeRouting, true, 'media must release even while native routing cleanup is pending');
    assert.equal(newPeer.closed, false, 'old cleanup must not close a replacement peer');
    assert.equal(callService.getSession(), replacement);
  } finally { audioRouteService.stopCallAudio = stopAudio; callService.currentSession = null; callService.pc = null; }
});
test('remote track arrival publishes the event native stream before transport connects', () => {
  const placeholder = { getTracks: () => [], addTrack() { throw Error('must use native event stream'); } };
  const video = { kind: 'video', id: 'remote-video', readyState: 'live' };
  const nativeStream = { getTracks: () => [video], getVideoTracks: () => [video], toURL: () => 'native-react-tag' };
  const peer = { connectionState: 'new', iceConnectionState: 'new' };
  const session = { state: 'connecting', remoteStream: placeholder };
  callService.pc = peer; callService.currentSession = session;
  const updates = [];
  const unsubscribe = callService.onSessionChange(s => updates.push(s?.remoteStream));
  try {
    callService.bindPeerConnectionEvents(peer, placeholder);
    peer.ontrack({ track: video, streams: [nativeStream] });
    assert.equal(callService.getSession().remoteStream, nativeStream);
    assert.equal(updates.at(-1), nativeStream);
  } finally { unsubscribe(); callService.pc = null; callService.currentSession = null; }
});
test('video renderer waits for a real video track before exposing a stream URL', async () => {
  const { renderableVideoURL } = await import('../apps/mobile/services/nativeWebRTC.ts');
  assert.equal(renderableVideoURL({ getVideoTracks: () => [], toURL: () => 'empty' }), null);
  assert.equal(renderableVideoURL({ getVideoTracks: () => [{ readyState: 'ended' }], toURL: () => 'ended' }), null);
  assert.equal(renderableVideoURL({ getVideoTracks: () => [{ readyState: 'live' }], toURL: () => 'native-react-tag' }), 'native-react-tag');
});
