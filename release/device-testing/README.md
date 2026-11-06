# IndiChat physical-device test builds

## Android
Open `IndiChat-Android.apk` on your Android phone and allow installation from the file source when prompted. This is a release-mode local test build signed with the existing Android development certificate, not a Play Store release. It contains its JavaScript bundle and does not require Metro.

If an installed copy has a different signing certificate, Android will reject an update. Do not uninstall it without preserving its data.

## iPhone
An iPhone requires an Apple-signed IPA or installation through Xcode. An APK and the existing iOS Simulator ZIP cannot be installed on a physical iPhone. This Mac currently has zero valid code-signing identities and no installed provisioning profiles. The physical-device archive (`IndiChat-iPhone-Unsigned-Archive.zip`) built successfully for arm64 iPhone hardware, including WebRTC. It is compiled without signing and is not directly installable. The original archive is at `release/ios/IndiChat-Unsigned.xcarchive`.

To enable installation, open `apps/mobile/ios/IndiChat.xcworkspace` in Xcode, add your Apple account in Xcode Settings > Accounts, then select the IndiChat target > Signing & Capabilities and choose your team. Connect and unlock the iPhone, trust the Mac, and enable Developer Mode if requested. Select the connected phone as the destination. For a test build without Metro, edit the scheme Run configuration to Release, then build/run through Xcode. A personal team may require a unique bundle identifier. Distribution IPA export additionally requires an appropriate signing profile and supported distribution method.

## Backend connection
Put your phone and Mac on the same Wi-Fi. In IndiChat Server Connection, set `http://192.168.1.9:8080` (the Mac address observed during this build; update it if your network changes). The backend must be running and reachable. Do not use localhost or 10.0.2.2 on physical phones.

## Acceptance limits
Android audio/video and iOS simulator audio previously passed in the reported test environments. Physical iPhone video, camera switching, actual speaker/earpiece routes, and repeated-call stability still need testing. An older simulator CoreAudio abort remains unresolved. Building these artifacts does not complete those checks.
