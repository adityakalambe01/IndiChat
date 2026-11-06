# Native audio isolation probe

This scene-based simulator app compares actual VoiceProcessingIO and the installed
Jitsi WebRTC framework without the messaging app or signaling server. It uses no
mock audio or connection state.

- `camera`: enumerate real RTCCameraVideoCapturer devices and count captured frames;
  zero devices is an explicit failure, with no generated-camera substitution.
- `raw`: AVAudioSession activation and VoiceProcessingIO initialization/start.
- `webrtc`: native two-peer audio loopback, without the IndiChat audio bridge.
- `bridge`: the same loopback calls the **production** IndiChatAudioRoute class;
  only React's bridge transport macros are stubbed. Three calls assert incoming
  and outgoing RTP and zero remaining activation ownership after every teardown.
  Repeated start/stop and actual output-port inspection are included.

Build with the reconciled CocoaPods installation:

```sh
bash scripts/native-audio-probe/build.sh
xcrun simctl install "$IOS_SIMULATOR_UDID" /tmp/indichat-runtime-followup/NativeAudioProbe.app
xcrun simctl privacy "$IOS_SIMULATOR_UDID" grant microphone com.indichat.audioprobe
SIMCTL_CHILD_AUDIO_PROBE_MODE=bridge xcrun simctl launch --terminate-running-process --console "$IOS_SIMULATOR_UDID" com.indichat.audioprobe
```

Keep the probe foregrounded until it exits. Installing/activating another app can
suspend its timers. A successful `connected` message is insufficient: require
nonzero bidirectional RTP and all three `active=0 owner=0` teardown lines.

This fixture does not prove the full app's camera, renderer, or audible output.
A receiver request that reports `speaker` is a hardware limitation, not a verified
route change. Do not disable audio or change WebRTC's manual-audio flags to mask
an initialization failure.

The initial fixture lacked scene lifecycle adoption and trapped in UIKit before
reaching audio code. Its manifest and UIWindowSceneDelegate now meet the SDK's
scene lifecycle requirement. That SIGTRAP is distinct from the reproduced
WebRTC/CoreAudio initialization SIGABRT.
