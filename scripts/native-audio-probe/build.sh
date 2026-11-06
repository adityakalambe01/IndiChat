#!/bin/bash
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/../.." && pwd)"
probe_dir="${1:-/tmp/indichat-runtime-followup/NativeAudioProbe.app}"
framework_dir="$root_dir/apps/mobile/ios/Pods/JitsiWebRTC/WebRTC.xcframework/ios-arm64_x86_64-simulator"
mkdir -p "$probe_dir/Frameworks"
cp -R "$framework_dir/WebRTC.framework" "$probe_dir/Frameworks/"
xcrun --sdk iphonesimulator clang -arch arm64 -isysroot "$(xcrun --sdk iphonesimulator --show-sdk-path)" -mios-simulator-version-min=16.4 -fobjc-arc -I "$root_dir/scripts/native-audio-probe/stubs" -F "$framework_dir" -framework Foundation -framework UIKit -framework AVFoundation -framework AudioToolbox -framework WebRTC -Wl,-rpath,@executable_path/Frameworks "$root_dir/scripts/native-audio-probe/main.m" -o "$probe_dir/NativeAudioProbe"
cat > "$probe_dir/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.indichat.audioprobe</string><key>CFBundleExecutable</key><string>NativeAudioProbe</string><key>CFBundleName</key><string>NativeAudioProbe</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>MinimumOSVersion</key><string>16.4</string><key>NSCameraUsageDescription</key><string>Isolate native camera frame generation for IndiChat testing.</string><key>NSMicrophoneUsageDescription</key><string>Isolate native WebRTC microphone initialization for IndiChat testing.</string><key>UILaunchScreen</key><dict/><key>UIApplicationSceneManifest</key><dict><key>UIApplicationSupportsMultipleScenes</key><false/><key>UISceneConfigurations</key><dict><key>UIWindowSceneSessionRoleApplication</key><array><dict><key>UISceneConfigurationName</key><string>Default</string><key>UISceneDelegateClassName</key><string>ProbeScene</string></dict></array></dict></dict>
</dict></plist>
PLIST
printf '%s\n' "$probe_dir"
