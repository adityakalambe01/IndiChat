# Native acceptance controls

These are separate test drivers; they do not modify IndiChat, reset its storage,
or insert test hooks into its release bundle.

## Android

```sh
bash scripts/native-ui-test/android/build.sh
adb -s emulator-5554 install -r /tmp/indichat-runtime-followup/android-ui-driver/driver.apk
node scripts/verify_native_acceptance.mjs
```

The instrumentation driver reads the active accessibility tree after its service
connects. Unlike `uiautomator dump`, it does not require an idle UI. This matters
for call-duration/statistics updates. Native clicks still use observed labels and
bounds, and assertions check changed labels and eventual teardown.

`node scripts/verify_reduced_motion_android.mjs` checks immediate preference
selection and save/relaunch persistence, then restores the observed System
preference. It waits for Save completion and screen readiness; stopping the app
before its asynchronous save completes is not a persistence test.

## iOS XCTest driver

```sh
GEM_HOME=/opt/homebrew/Cellar/cocoapods/1.17.0_1/libexec ruby scripts/native-ui-test/create-project.rb
xcodebuild build-for-testing -project /tmp/indichat-runtime-followup/ui-driver/RuntimeUI.xcodeproj -scheme RuntimeUI -sdk iphonesimulator -destination "id=$IOS_SIMULATOR_UDID" -derivedDataPath /tmp/indichat-runtime-followup/ui-build CODE_SIGNING_ALLOWED=NO
xcodebuild test-without-building -project /tmp/indichat-runtime-followup/ui-driver/RuntimeUI.xcodeproj -scheme RuntimeUI -destination "id=$IOS_SIMULATOR_UDID" -derivedDataPath /tmp/indichat-runtime-followup/ui-build -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO
```

The test reads commands from its own Documents/IndiChatAcceptance directory.
`command.mjs DEVICE state` inspects the app. A driver test pass means its submitted
commands passed, not that a complete media acceptance matrix ran. Preserve its
command files/result bundle when diagnosing errors; archive the driver's prior
commands before starting another session, so stale taps cannot replay.

XCTest on the current runtime waited approximately 60 seconds for app animation
completion and sometimes lost a label locator during that wait. Do not use a
short controller timeout that leaves a tap executing after the controller has
failed. Failed XCTest sessions are recorded in the main task report.

## Device Hub fallback

`IOS_UI_DRIVER=cua` sends native action requests to
`/tmp/indichat-runtime-followup/cua-ui-queue` for direct Device Hub computer use.
After inspecting current UI state and performing the requested interaction,
`respond-devicehub.mjs COMPLETED_LABEL OBSERVED_LABEL...` records that observation.
Never acknowledge an unperformed action or invent labels. The coordinator keeps
all RTP, decoded-video, and teardown assertions. Screenshots are captured from
the selected simulator. This mode requires an active controller, not unattended
execution.

```sh
NATIVE_PLATFORM=ios IOS_UI_DRIVER=cua IOS_SIMULATOR_UDID="$IOS_SIMULATOR_UDID" node scripts/verify_native_acceptance.mjs
```

The actual web app runs in an isolated Chrome profile with synthetic browser
capture. Its production signaling/call UI is unmodified; peer connection and
capture references are observed for stats/cleanup. This differs from
`verify_cross_browser_call.mjs`, which injects an independent synthetic signaling
peer. `CALL_CASES=outgoing-video,incoming-video` selects focused failed cases;
default execution includes all four connected-call cases and decline/cancel
checks. It never relaxes RTP or frame assertions.
