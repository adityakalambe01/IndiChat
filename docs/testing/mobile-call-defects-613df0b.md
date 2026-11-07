# Mobile call defects: implementation and verification

Date: 2026-11-06 (Asia/Kolkata). Starting checkout: clean `main`, `613df0b4aa05bfc4c297c10fda0751e3b7208d15`.

## Native runtime follow-up — current result

Follow-up completed on the same `main` checkout with all earlier uncommitted fixes preserved. The sections below “Original implementation record” describe the earlier run; this follow-up supersedes its runtime blockers where explicitly stated. **Native acceptance is partial:** Android actual-web audio/video passed; iOS actual-web audio passed, but full iOS video and physical receiver routing remain unverified. The original iOS 27.0 CoreAudio failure remains reproducible outside the app, with no demonstrated application audio-session correction required by that reproduction.

### Additional production corrections

- `apps/mobile/services/callService.ts`: release the captured peer and local tracks synchronously before awaiting native audio shutdown. Detach old handlers, and guard later history/timer updates by session identity. A deferred-shutdown regression first failed because the old teardown closed a replacement peer; it now passes.
- The same service now publishes the native stream from `ontrack` immediately. Appending tracks to an already-mounted empty placeholder stream left RTCView black despite received RTP. Session/peer guards prevent stale track events.
- `apps/mobile/services/nativeWebRTC.ts` and `apps/mobile/components/CallOverlay.tsx`: mount remote RTCView only with a renderable, non-ended video track; give remote/local surfaces appropriate ordering. Production-handler and renderable-URL regressions pass. The final Android screenshot visibly renders the browser's moving green video pattern; the earlier black-renderer screenshot is retained.
- Added coverage in `scripts/test_call_fixes.mjs`. No production audio was disabled, no native module was omitted, and RTP requirements were retained.

### Android recovery and final installed acceptance

The existing `emulator-5554` recovered without wiping it or clearing application data. It reports boot completion, a running `system_server` (PID 5228 at capture), and an activity service. DropBox watchdogs show ActivityManager/main/display handlers blocked for 61–95 seconds during earlier host load; one capture shows ranchu graphics composer consuming 58% CPU and total CPU saturated, mainly kernel. No `system_server_crash` entry was present. This identifies observed watchdog stalls, not a proven permanent emulator defect. Evidence: `/tmp/indichat-runtime-followup/android-watchdogs.txt` and `android-server-crashes.txt`.

Installed the final APK with `adb install -r release/android/IndiChat.apk`, then verified `adb shell am start -W -n com.indichat.app/.MainActivity` succeeded. The final actual-web run passed incoming/outgoing audio and video, nonzero RTP both directions, decoded native video in Chrome (360×640), native remote rendering, mute/unmute, camera switch/off/on, hangup, decline in both directions, and outgoing cancellation. Browser peers closed and capture tracks ended; native UI dismissed. Android camera-service evidence shows actual camera IDs 1 ↔ 10 and zero active clients after teardown. Audio mode returns to normal. Speaker requests were exercised, but the emulator has no earpiece and reports speaker: **physical speaker-to-receiver switching did not pass**.

Command: `NATIVE_PLATFORM=android EVIDENCE_DIR=/tmp/indichat-runtime-followup/acceptance-android-renderer node scripts/verify_native_acceptance.mjs`. Result: pass. Log: `actual-web-android-renderer.log`; screenshots, audio/camera dumps: `acceptance-android-renderer/`, particularly `outgoing-video.png`. Earlier pre-fix rendering evidence remains in `acceptance-android-final/`.

### iOS AudioUnit isolation and independent results

Original simulator: iPhone 17, iOS 27.0, `7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52`. Original crash `~/Library/Logs/DiagnosticReports/IndiChat-2026-11-06-213158.ips` aborts in `AURemoteIO::Initialize → AudioUnitInitialize → VoiceProcessingAudioUnit::Initialize → AudioDeviceIOS::InitPlayOrRecord/InitPlayout`. AudioControl waits in AQIONode/RemoteIO connection work; main is idle. No IndiChat bridge lock is on that failing stack.

The new `scripts/native-audio-probe/` links the installed Jitsi framework and uses real native peers/RTP. Raw VoiceProcessingIO starts on the original simulator, but **WebRTC-only loopback without React or IndiChatAudioRoute reproduced the CoreAudio SIGABRT** (`NativeAudioProbe-2026-11-06-220407.ips`, `probe-webrtc-native.log`). The user's pasted earlier probe SIGTRAP was a separate UIKit scene-lifecycle requirement, before audio initialization; the probe now has a scene delegate/manifest. It was not evidence of an application audio-session crash.

A separate, non-destructive iPhone 17 simulator was created on installed iOS 27.2: `IndiChat-Audio-Isolation`, `0C5F46A2-E0E7-4C2B-8C9A-F74D95A5E6D7`. WebRTC-only RTP passed (`probe-webrtc-27.2.log`). Three successive loopback calls importing the **production bridge implementation** passed strict incoming/outgoing RTP, repeated start/stop, and `RTCAudioSession.isActive=0`, bridge ownership=0 after every teardown (`probe-three-rounds-27.2.log`). Inspection covers shared RTCAudioSession configuration locking and balanced activation ownership; no manual-audio workaround was added. A bridge-configured run also passed on the original runtime, so runtime version, device state, and timing remain confounded. This does not establish an OS-version-only cause or repair the underlying 27.0 AudioUnit abort.

Native probe commands:

```sh
bash scripts/native-audio-probe/build.sh
xcrun simctl install "$IOS_SIMULATOR_UDID" /tmp/indichat-runtime-followup/NativeAudioProbe.app
xcrun simctl privacy "$IOS_SIMULATOR_UDID" grant microphone com.indichat.audioprobe
SIMCTL_CHILD_AUDIO_PROBE_MODE=webrtc xcrun simctl launch --terminate-running-process --console "$IOS_SIMULATOR_UDID" com.indichat.audioprobe
SIMCTL_CHILD_AUDIO_PROBE_MODE=bridge xcrun simctl launch --terminate-running-process --console "$IOS_SIMULATOR_UDID" com.indichat.audioprobe
SIMCTL_CHILD_AUDIO_PROBE_MODE=camera xcrun simctl launch --terminate-running-process --console "$IOS_SIMULATOR_UDID" com.indichat.audioprobe
```

On the final installed iOS app (27.2), actual-web outgoing audio yielded browser inbound/outbound packets 9/64; incoming audio 260/260 with positive received energy. Mute/unmute controls, native hangup, browser track release and native dismissal passed. Evidence: `actual-web-ios-devicehub.log`, `acceptance-ios-devicehub/`. That combined run subsequently failed waiting for a web Answer button on the video case; it is **not a whole-matrix pass**. A separate `CALL_CASES=controls` run passed web decline, native decline and native cancellation (`actual-web-ios-controls.log`, `acceptance-ios-controls/`); its historical blanket PASS text applies only to those selected controls. The harness now prints selected cases explicitly.

Strict video acceptance failed: `actual-web-ios-video.log`, `Timed out: bidirectional audio/video RTP`. A minimal RTCCameraVideoCapturer probe on the same simulator reports `camera devices=0`, exit 5 (`probe-camera.log`). No generated native camera was substituted. A later receive-only observation attempt timed out waiting for Device Hub Accept, adding no media proof (`actual-web-ios-receive-video.log`). Native iOS remote video rendering, camera switching and full bidirectional video therefore remain unverified. The paired physical iPhone was unavailable (`physical-devices.txt`). Both simulators route receiver requests to speaker, so actual physical route changes and audible call quality remain unverified.

The separate XCTest driver built successfully, but animation-idle waits/locator failures prevented reliable media coordination (`ui-driver-final.log`, `native-ui-final.xcresult`, `ios-app-sample.txt`, `ios-ui-runner-sample.txt`; coordinate attempt in `ui-driver-coordinate.log`). The app main-thread sample was idle. Those failures were diagnosed, not counted as passing acceptance. Device Hub direct controls were used for the successful iOS cases. Final native UI was observed back in the conversation without an active call. No CoreAudio abort occurred during the successful 27.2 audio cases/probe rounds.

Actual-web command prefix: `NATIVE_PLATFORM=ios IOS_UI_DRIVER=cua IOS_SIMULATOR_UDID=0C5F46A2-E0E7-4C2B-8C9A-F74D95A5E6D7 EVIDENCE_DIR=/tmp/indichat-runtime-followup/acceptance-ios-devicehub node scripts/verify_native_acceptance.mjs`; focused reruns add `CALL_CASES=controls`, `outgoing-video`, or `incoming-video` and their distinct evidence directory. Device Hub request acknowledgements record observed actions only. Synthetic browser media is used by the **actual web application's** call UI/signaling. This differs from the older synthetic signaling peer in `verify_cross_browser_call.mjs`; neither proves audible hardware quality.

### Reduced Motion and verification commands

Android: `node scripts/verify_reduced_motion_android.mjs` passed immediate On selection, saved cold-relaunch persistence, and restoration to original System (`motion-android-synchronized.log`, `motion-android-*.xml`). An earlier unsynchronized attempt inspected before save/load completion and failed; the helper now waits for completion. iOS: Device Hub verified immediate On, saved restart persistence (`motion-ios-restored-on.png`), then restored original System. Slide motion was observed again after restoring System. Production navigation resolver tests cover immediate none/slide selection; frame timing was not quantitatively measured. Original theme/blur/transparency preferences were preserved.

All following logs are under `/tmp/indichat-runtime-followup/`:

| Exact command | Result / log |
| --- | --- |
| `node --experimental-strip-types --test scripts/test_call_fixes.mjs scripts/test_call_service.mjs scripts/test_webrtc_spike.mjs scripts/test_appearance_persistence.mjs scripts/test_backup_service.mjs scripts/test_ios_build_workflow.mjs` | 44 passed, zero failures/skips; `final-tests.log` |
| `node --experimental-strip-types --test scripts/test_auth_recovery.mjs` | 11 passed; `auth-tests.log` |
| `npx tsc --noEmit -p apps/mobile/tsconfig.json` | pass; `final-tsc.log` |
| `npm run web:build` | pass; `web-build.log` |
| `npm run build:android:apk` | pass; `android-renderer-build.log` |
| `PATH="$HOME/Library/Android/sdk/cmake/3.22.1/bin:$PATH" npm run build:ios:sim` | pass, supported pod reconciliation workflow; `ios-build.log` |
| `xcodebuild -workspace IndiChat.xcworkspace -scheme IndiChat -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO` (in `apps/mobile/ios`) | final incremental renderer build pass; `ios-renderer-build.log`; native dependencies unchanged after reconciliation |
| `ditto apps/mobile/ios/build/Build/Products/Release-iphonesimulator/IndiChat.app release/ios/IndiChat.app` then `ditto -c -k --sequesterRsrc --keepParent release/ios/IndiChat.app release/ios/IndiChat-Simulator.zip` | final simulator artifacts packaged and installed |

### Final artifacts and changed verification files

SHA-256 (`artifact-sha256-final.txt`):

```text
c1bbd7cd8f9813ffcb54d0d1f21e7415199c52f7c2d31413ec8cf9ad088c0d37  release/android/IndiChat.apk
bc0de3696ad893b48e7813915f5e9e399059394272e7a0080a63dc0bb0edaac3  release/ios/IndiChat-Simulator.zip
d8b76fcc531847c9d5fd8b6b50a4fecb3df143cdb6f9b2beee2c61645b44527f  release/ios/IndiChat.app/IndiChat
b7f79fd367d0725006555b3e9977742c942ac9d1a10ceff95382f81102ab308e  release/ios/IndiChat.app/main.jsbundle
```

Paths are relative to the project root (`.`); evidence paths are local `/tmp/indichat-runtime-followup/` (ephemeral). Added `scripts/verify_native_acceptance.mjs`, `scripts/verify_reduced_motion_android.mjs`, `scripts/native-audio-probe/{main.m,build.sh,README.md,stubs/React/RCTBridgeModule.h}`, and `scripts/native-ui-test/{RuntimeUITests.swift,create-project.rb,command.mjs,respond-devicehub.mjs,README.md,android/Driver.java,android/AndroidManifest.xml,android/build.sh}`. The Android instrumentation driver is separate from the installed production app and avoids uiautomator's call-timer idle timeout. The XCTest driver uses its own command documents, not app hooks. Failed attempts and diagnostics remain in the evidence directory.

Unrelated changes and original app data were preserved. Acceptance added normal demo-account call-history entries. No database/app-data clearing, redesign, public-contract change, commit, push or deployment occurred. The remaining work requires an available physical iPhone for camera/rendering/actual route validation and further native AudioUnit/runtime investigation on the failing 27.0 environment; shared tests cannot establish that behavior.

Self-evaluation (agent-self-evaluation skill): accuracy 4/5 (native evidence separated from inference; underlying AudioUnit cause remains unresolved), completeness 3/5 (physical video/routing acceptance blocked), clarity 4/5 (historical and current results separated), actionability 4/5 (commands/artifacts/evidence supplied; ephemeral logs should be retained), conciseness 3/5 (long diagnostic record). Overall 3.6/5. Highest-impact next checks: physical iOS video/routes; capture native vendor diagnostics for the isolated 27.0 reproduction. The user would reasonably consider native acceptance incomplete.

## Original implementation record

## Implemented fixes

- RTCView capability detection uses `WebRTCModule.getUserMedia` and `peerConnectionInit`, both present in the installed react-native-webrtc 155.0.1 native implementations. `startCall` is not its API. Import failure/missing bindings produce an unavailable video view, never simulated media. Cleanup prevents publishing a view after unmount.
- Audio routing reports missing bindings, rejected promises, explicit native failure, malformed results, and unknown routes as failure. The call service changes its speaker indicator only on success, using the returned state. Initial video-call speaker state is no longer assumed. Session identity and a teardown generation prevent stale initialization/toggle completions from changing another or ending call.
- Added iOS routing through a local CocoaPod using the actual Jitsi `RTCAudioSession` configuration lock, play-and-record category, voice-chat mode, output override, actual output-port inspection, and balanced activation/deactivation. Native errors reject the bridge promise. The Expo plugin preserves this integration on prebuild. Missing routing bindings disable and label the control. Android native routing was preserved.
- CocoaPods successfully reconciled the existing project: lockfile now includes react-native-webrtc 155.0.1, JitsiWebRTC 155.0.1, and IndiChatAudioRoute 1.0.0. The Xcode framework embedding phase now includes WebRTC. The iOS build workflow always installs pods, including for an existing native project.
- Navigation derives `none`/`slide_from_right` from `useTheme().isReducedMotion` each render, covering saved preferences, staged preview, and OS accessibility resolution. Existing settings persistence is reused.
- Strengthened the calling acceptance harness: correct existing login request field; lookup test identities; isolated Chrome profile and dynamic debugging port; bounded CDP requests; early ICE queue; existing native autoCall deep link; independent iOS mode; real inbound/outbound RTP assertions; peer hangup and browser track cleanup. This is a browser WebRTC peer with synthetic browser capture, not an end-to-end test of the web app's call UI. It does not infer native rendering or teardown from browser state.

## Changed files

Production/UI:
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/components/CallOverlay.tsx`
- `apps/mobile/services/audioRoute.ts`
- `apps/mobile/services/callService.ts`
- `apps/mobile/services/nativeWebRTC.ts` (new)
- `apps/mobile/theme/navigation.ts` (new)

Native/build:
- `apps/mobile/native/audio-route/IndiChatAudioRoute.m` (new)
- `apps/mobile/native/audio-route/IndiChatAudioRoute.podspec` (new)
- `apps/mobile/plugins/withAudioRoute.js`
- `apps/mobile/ios/Podfile`
- `apps/mobile/ios/Podfile.lock`
- `apps/mobile/ios/IndiChat.xcodeproj/project.pbxproj` (CocoaPods-generated framework embedding changes)
- `scripts/build-ios.js`

Verification:
- `scripts/test_call_fixes.mjs` (new)
- `scripts/test_ios_build_workflow.mjs` (new)
- `scripts/test_appearance_persistence.mjs`
- `scripts/verify_cross_browser_call.mjs`
- this report

## RED/GREEN evidence

`node --experimental-strip-types scripts/test_call_fixes.mjs` initially failed the audio-routing assertions: unsupported routing returned success; failed routing changed the indicator; replacement received a stale result; teardown caused a null dereference; requested state replaced the actual returned state. The first unsupported-platform fixture used iOS, then was corrected to remove native bindings when iOS routing was implemented. Other failures exercised production callService logic directly.

Capability/navigation tests initially referenced the new missing production helpers (missing-implementation RED). They now exercise those helpers. The RTCView cleanup test resolves a pending import after cleanup and verifies no publication.

`node --test scripts/test_ios_build_workflow.mjs` initially failed because an existing native project bypassed `pod install`. It now passes, executing the actual build script in a VM with external filesystem/process boundaries stubbed.

Final targeted suite: **41 tests passed, zero failed/skipped**. Tests cover routing success/failure/unsupported/malformed state, actual returned state, call replacement, teardown while native cleanup is pending, WebRTC detection/import failure/unmount, navigation theme resolution, immediate subscription changes and cold reload persistence, plus existing call, backup, and WebRTC spike regressions.

Final coverage for the three focused modules (`audioRoute.ts`, `nativeWebRTC.ts`, `navigation.ts`): **100% lines, 90.91% branches, 92.86% functions**. This is scoped logic coverage, not whole-app/component/native hardware coverage. Authentication recovery passed separately, **11/11**, making 52 successful automated tests across those runs.

## Commands and actual results

Commands ran from repository root unless a working directory is specified. Permission-limited attempts are recorded separately from successful retries; no tests were disabled or assertions weakened.

| Command | Result |
| --- | --- |
| `git status --short --branch` / `git rev-parse HEAD` | Exit 0; clean main at the requested commit. |
| `npm ls react-native-webrtc --workspace=apps/mobile` | Exit 0; installed 155.0.1. No npm reinstall was necessary. |
| `pod install` (cwd `apps/mobile/ios`) | Initial exit 1: restricted GitHub DNS access and missing CMake on PATH; monorepo NODE_PATH warning also observed. |
| `NODE_PATH="$PWD/apps/mobile/node_modules:$PWD/node_modules" pod install --project-directory=apps/mobile/ios` | Exit 1: invoking from root caused autolinking `Pathname.new requires a String` at Podfile line 49. Corrected to run from the iOS working directory. |
| `PATH="$HOME/Library/Android/sdk/cmake/3.22.1/bin:$PATH" NODE_PATH="$PROJECT_ROOT/apps/mobile/node_modules:$PROJECT_ROOT/node_modules" pod install` (cwd `apps/mobile/ios`, elevated) | Exit 0; 116 dependencies / 116 pods. Installed both WebRTC pods and routing bridge. |
| `npx tsc --noEmit -p apps/mobile/tsconfig.json` | Final exit 0. Intermediate new TS narrowing/return-type errors were fixed and rerun. |
| `npm run web:build` | Exit 0; existing chunk-size warning (536.28 kB main JS). |
| `node --experimental-strip-types --test scripts/test_call_service.mjs scripts/test_webrtc_spike.mjs scripts/test_appearance_persistence.mjs scripts/test_auth_recovery.mjs scripts/test_backup_service.mjs` | Initial exit 1: 31 passed / 6 auth live failures due sandbox localhost EPERM. |
| `node --experimental-strip-types --test scripts/test_auth_recovery.mjs` (elevated) | Exit 0; **11/11 passed**, including live backend recovery. |
| `node --experimental-strip-types --test --experimental-test-coverage --test-coverage-include='apps/mobile/services/audioRoute.ts' --test-coverage-include='apps/mobile/services/nativeWebRTC.ts' --test-coverage-include='apps/mobile/theme/navigation.ts' scripts/test_call_fixes.mjs scripts/test_call_service.mjs scripts/test_webrtc_spike.mjs scripts/test_appearance_persistence.mjs scripts/test_backup_service.mjs scripts/test_ios_build_workflow.mjs` | Exit 0; **41/41 passed**. |
| `npm run build:android:apk` | Initial exit 1: Gradle cache lock EPERM. Elevated retry exit 0, BUILD SUCCESSFUL in 4m 37s. Final rebuild after production edits also exit 0. |
| `PATH="$HOME/Library/Android/sdk/cmake/3.22.1/bin:$PATH" npm run build:ios:sim` (elevated) | Exit 0; **BUILD SUCCEEDED**, universal arm64/x86_64 simulator release. No module omissions or test-disabling build overrides. |
| `adb -s emulator-5554 install -r release/android/IndiChat.apk` (full SDK adb path) | Exit 0, Success. Existing app data retained. |
| `xcrun simctl install booted release/ios/IndiChat.app` / `xcrun simctl launch booted com.indichat.app` | Exit 0; launched PID 84123. Existing Bob session and conversations displayed. |
| `node scripts/verify_cross_browser_call.mjs` | Original harness exit 1: Chrome debug port ECONNREFUSED. After harness repairs, browser peer starts; Android attempt fails before calling because emulator activity service is missing. |
| `adb -s emulator-5554 shell service check activity` (full SDK adb path) | `Service activity: not found`, including after `adb ... reboot` (exit 0). No emulator wipe performed. |
| `NATIVE_PLATFORM=ios node scripts/verify_cross_browser_call.mjs` | First exit 1: native microphone permission prompt prevented offer. Prompt and usage text independently observed. |
| `xcrun simctl privacy booted grant microphone com.indichat.app` | Exit 0; grants the local test app's requested mic permission. Subsequent terminate reported no running app; relaunch succeeded (PID 84797). |
| `NATIVE_PLATFORM=ios node scripts/verify_cross_browser_call.mjs` (after permission) | Exit 1 on genuine RTP assertion. Offer received, answer sent, browser transport **connected**. Browser outbound audio: **229 packets / 11174 bytes**. Browser inbound: **none**. Not an acceptance pass. |
| `xcrun simctl spawn booted log show --last 3m --style compact --predicate 'process == "IndiChat"'` | Exit 0; native fatal CoreAudio error captured, below. |
| `otool -L release/ios/IndiChat.app/IndiChat` / `nm release/ios/IndiChat.app/IndiChat` | Exit 0; WebRTC.framework linked; WebRTCModule, RTCVideoView, and IndiChatAudioRoute symbols present for both simulator architectures. |
| Bundle byte inspection (Python ZipFile for Android; Path.read_bytes for iOS) | Both final bundles contain `Video view unavailable on this build`, `Call ended during audio setup.`, and `Audio routing unavailable`, confirming final fixes are packaged. |
| `node --check scripts/build-ios.js`; `node --check scripts/verify_cross_browser_call.mjs`; `node --check apps/mobile/plugins/withAudioRoute.js`; `ruby -c apps/mobile/native/audio-route/IndiChatAudioRoute.podspec`; `git diff --check` | All exit 0. |

Build warnings were retained: iOS Bluetooth category option deprecation, dependency script-phase warnings, existing Android dependency/Gradle warnings, and the web chunk-size warning.

## Artifacts

Fresh outputs, not committed:
- `./release/android/IndiChat.apk`
- `./release/android/app-release.apk`
- `./release/ios/IndiChat.app`
- `./release/ios/IndiChat-Simulator.zip`
- `./apps/web/dist/`

Primary logs (local temporary files):
- `/private/tmp/indichat-pods-native.log`
- `/private/tmp/indichat-ios-build.log`
- `/private/tmp/indichat-android-final.log`
- `/private/tmp/indichat-final-tests.log`
- `/private/tmp/indichat-auth-live.log`
- `/private/tmp/indichat-web-build.log`
- `/private/tmp/indichat-tsc-final.log`
- `/private/tmp/indichat-cross-browser-final.log`
- `/private/tmp/indichat-ios-call.log`
- `/private/tmp/indichat-ios-call-permitted.log`
- `/private/tmp/indichat-ios-media.log`
- `/private/tmp/indichat-ios-current.png` (successful launch / existing data)
- `/private/tmp/indichat-ios-call-current.png` (actual microphone prompt)

## Remaining runtime blockers — not verified

1. **Android emulator**: installed final APK, but its activity service disappeared. Both initial/recovery checks returned `Service activity: not found`; restarting it did not restore the service. Android↔browser connection, media rendering, routing, teardown, and repeated calls therefore remain unverified on the final APK. Earlier screenshots in release/android/verification are pre-existing and are not evidence for this change.
2. **iOS native media**: real SDP/ICE/transport reached connected, but the app aborted in native CoreAudio initialization before any RTP arrived at the browser from iOS. Exact log: `2026-11-06 21:31:52.580 ... Initialize: RPC timeout. Apparently deadlocked. Aborting now.` Crash report: `/Users/innodaredevil/Library/Logs/DiagnosticReports/IndiChat-2026-11-06-213158.ips`, SIGABRT, triggered WebRTC worker thread: `AURemoteIO::Initialize -> AudioUnitInitialize -> VoiceProcessingAudioUnit::Initialize -> AudioDeviceIOS::InitPlayOrRecord -> InitPlayout`. Root cause beyond this trace is unresolved; host/simulator audio and the native integration need independent investigation. It must not be described as a passing audio call or attributed conclusively to the simulator alone.
3. **Native speaker switching, audible microphone/speaker output, iOS remote video rendering, denial/regrant behavior, teardown, repeated full calls, and visual navigation transitions** remain unverified interactively. Device Hub's computer-use accessibility returned `AXError.cannotComplete`; the Simulator app identifiers were unavailable. Unit tests prove lifecycle/navigation/routing decisions, not native hardware behavior.
4. **No signed iOS device archive, physical-device call, or Android App Bundle was requested/generated in this run.** Native release APK and simulator app builds succeeded independently. No native test target was disabled; this build workflow does not itself run an XCTest suite.

The approved Liquid Glass components, preview staging, stored conversations, message/receipt semantics, authentication implementation, and backup implementation were not modified. Existing auth/backup regressions passed. Acceptance attempts may add normal call-history entries for demo accounts; no conversations, app storage, or databases were cleared. No public REST/WebSocket/shared contracts, commits, pushes, publications, or deployments were made.

## Self-evaluation

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4/5 | Actual build/test results and failing RTP assertion distinguished; native crash cause remains unresolved beyond stack evidence. |
| Completeness | 3/5 | Implemented requested fixes and builds, but full Android/iOS runtime acceptance is blocked as listed above. Resume with a healthy emulator and functional native audio environment. |
| Clarity | 4/5 | Commands, artifacts, implemented behavior and runtime limits separated; report is long because failed attempts are retained. |
| Actionability | 4/5 | Reviewable diff, regression scripts, final binaries and exact native blockers provided; physical audio routing still needs verification. |
| Conciseness | 4/5 | Short final response points here for detailed evidence. |

Overall: 3.8/5. Highest-impact next steps: restore Android activity service; diagnose the iOS AudioUnit initialization abort; then run both directions of audio/video calls, speaker changes, and repeated teardown on each platform. The user should view this as implemented and build-verified fixes with explicitly incomplete native acceptance.

Recorded command paths are normalized for portability: set `PROJECT_ROOT="$(git rev-parse --show-toplevel)"` before using commands that reference it.
