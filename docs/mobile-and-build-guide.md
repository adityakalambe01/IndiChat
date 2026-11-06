# Mobile Development & Android Build Automation Guide

This guide covers the architecture, development workflow, and automated build pipelines for the **IndiChat Mobile Application** (`apps/mobile`).

---

## 1. Mobile Technology Stack

- **Framework**: React Native `0.86.3` + Expo `57.0.x` (SDK 52/57)
- **Routing**: Expo Router v4 (`expo-router/entry`) with file-based routing in `apps/mobile/app/`
- **Architecture**: React Native New Architecture enabled (`"newArchEnabled": true`)
- **UI Components**: Native WhatsApp/Telegram styling, custom SVG/PNG stickers (`StickerView`), vector icons (`@expo/vector-icons`), safe area insets (`react-native-safe-area-context`)
- **Networking**: Native `WebSocket` with automatic reconnection, `expo-file-system` for native multipart file uploads, and Axios-like fetch API wrapper
- **State & Storage**: `@react-native-async-storage/async-storage` for tokens, active server URL, device fingerprint, and local call logs

---

## 2. Directory Structure (`apps/mobile/`)

```
apps/mobile/
├── app.json                     # Expo configuration (package: com.indichat.app, newArchEnabled)
├── babel.config.js              # Babel presets
├── metro.config.js              # Metro bundler configuration with monorepo resolution
├── package.json                 # Mobile dependencies and run scripts
├── app/                         # Expo Router screens
│   ├── _layout.tsx              # Root Stack Navigator & Theme Provider
│   ├── index.tsx                # Authentication Screen (Login, Register, Passkeys)
│   ├── chats.tsx                # Conversation List, Status Tab, Calls Tab
│   ├── settings.tsx             # Settings (Profile, 2FA, Linked Devices, Network URL)
│   └── chat/
│       └── [id].tsx             # Active Chat Room (bubbles, ticks, media picker, call launcher)
├── components/
│   └── StickerView.tsx          # Multi-CDN SVG/PNG sticker component with fallbacks
├── data/
│   ├── emojiData.ts             # Emojis categorized by type
│   ├── gifData.ts               # Dynamic Google Tenor & GIPHY search service
│   └── stickerData.ts           # Sticker collection definitions
├── services/
│   ├── api.ts                   # REST client with automatic LAN IP deduction
│   ├── callHistory.ts           # Local call logging service with human-friendly timestamps
│   ├── settings.ts              # Settings synchronization with backend
│   ├── storage.ts               # AsyncStorage utility
│   └── websocket.ts             # Resilient WebSocket client
├── utils/
│   ├── device.ts                # Hardware/platform device ID generator
│   ├── i18n.ts                  # Localization strings (EN, ES, HI, FR, etc.)
│   ├── timeAgo.ts               # WhatsApp-style tiered relative time formatting
│   └── uuid.ts                  # Client-side UUID generator
└── android/                     # Prebuilt native Android project (Gradle, Manifest)
```

---

## 3. Local Development & Network Routing

When developing on mobile, communication between the mobile device and the backend API server (`localhost:8080`) requires special consideration.

### Automatic Host Deduction
In `apps/mobile/services/api.ts`, the app inspects `Constants.expoConfig?.hostUri`:
```typescript
function getDefaultHost(): string {
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost && typeof debuggerHost === 'string') {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8080`;
    }
  }
  return 'http://192.168.0.70:8080'; // Fallback LAN IP
}
```

### Physical Devices vs Emulators
1. **Physical Devices (Wi-Fi)**:
   - Your phone and your development machine must be connected to the same Wi-Fi network.
   - The app uses your computer's local IP address (e.g. `http://192.168.0.70:8080`).
   - If your network IP changes, update the server URL via **Settings -> Network Configuration** in the app.
2. **Android Emulator**:
   - The Android emulator routes to your computer via `http://10.0.2.2:8080`.
3. **Android Cleartext Traffic**:
   - `android:usesCleartextTraffic="true"` is enabled in `apps/mobile/android/app/src/main/AndroidManifest.xml` so the app can communicate with the backend over plain HTTP during local development without SSL errors.

---

## 4. Key Mobile Features & Implementations

### A. Real-Time Delivery Ticks
Messages render visual status indicators based on receipt timestamps:
- `✓` (Single grey): Message saved to backend database.
- `✓✓` (Double grey): Message received by recipient's active socket.
- `✓✓` (Double blue `#53bdeb`): Message opened and read by recipient.

### B. Live Dynamic GIFs & Multi-CDN Stickers
- **Dynamic GIFs**: `apps/mobile/data/gifData.ts` fetches live GIFs from Google Tenor and GIPHY APIs with debounced search and category filtering.
- **StickerView Multi-CDN Support**: Stickers are rendered via `<StickerView>` (`components/StickerView.tsx`). If the primary image URL fails to load, it automatically falls back through secondary CDNs (Telegram CDN, Cloudflare SVG, DiceBear) before showing a placeholder.
- **Transparent Borderless Display**: Stickers and GIFs render seamlessly on the chat background without card borders or white backgrounds.

### C. Native Multipart File Upload
Standard React Native `FormData` can trigger an `Unsupported FormDataPart implementation` error on Android when uploading binary files. IndiChat resolves this by using `expo-file-system` (`uploadAsync` / `ExpoFile`) in `apps/mobile/services/api.ts` to transmit image and audio payloads reliably to `POST /api/v1/files/upload`.

### D. In-Chat Call Logging & Status Bubbles
- Call events (voice & video) are logged locally in `services/callHistory.ts`.
- Calls are rendered as status bubbles directly inside the conversation thread (Incoming, Outgoing, Missed) with duration and timestamps formatted via `utils/timeAgo.ts`.

---

## 5. Automated Android Build Engine (`scripts/build-android.js`)

IndiChat provides an automated, zero-config build engine for producing Android APKs and Google Play App Bundles (.aab).

### How It Works:
1. **Environment Detection**:
   - Auto-detects `ANDROID_HOME` from `local.properties`, system variables, or default user paths (`$HOME/Android/Sdk`).
   - Auto-detects Java 17/21 from standard installation locations.
2. **Executable Verification**:
   - Automatically sets executable permissions (`chmod 755`) on `apps/mobile/android/gradlew`.
3. **Gradle Execution**:
   - Runs `:app:assembleDebug`, `:app:assembleRelease`, or `:app:bundleRelease` with `--no-daemon`.
4. **Artifact Management**:
   - Gathers generated binaries from `apps/mobile/android/app/build/outputs/`.
   - Copies artifacts to `release/android/` with human-readable timestamps.

### Build Commands:
```bash
# Build both Debug and Release APKs
npm run build:android:apk

# Build Google Play App Bundle (.aab)
npm run build:android:bundle

# Clean Gradle cache and build all targets
node scripts/build-android.js --clean
```

### Artifact Outputs (`release/android/`):
- `IndiChat-release-YYYY-MM-DD_HH-mm-ss.apk` — Standalone production APK ready for sideloading.
- `IndiChat-debug-YYYY-MM-DD_HH-mm-ss.apk` — Development APK with React Native debugging support.
- `IndiChat-release-YYYY-MM-DD_HH-mm-ss.aab` — Google Play Store distribution bundle.

---

## 6. Automated iOS Build Engine (`scripts/build-ios.js`)

IndiChat includes automated iOS build automation for macOS environments:
1. **Toolchain Verification**: Checks Xcode `xcodebuild`, macOS SDK, and CocoaPods.
2. **Native iOS Project Prebuild**: Automatically executes `expo prebuild --platform ios` and `pod install` with New Architecture and React Native 0.88 prebuilt artifacts.
3. **AppIcon Branding Synchronization**: Automatically syncs all official multi-resolution icon assets from `logo/ios/AppIcon.appiconset` to `apps/mobile/ios/IndiChat/Images.xcassets/AppIcon.appiconset`.
4. **Simulator & Device Compilations**:
   - Compiles iOS Simulator `.app` bundles (zero code signing certificates required for local testing).
   - Generates `.zip` distribution bundles in `release/ios/IndiChat-Simulator.zip`.
   - Supports device archives (`.xcarchive`) for TestFlight / App Store submission.

### Build Commands:
```bash
# Build iOS Simulator Release App
npm run build:ios:sim
# Or alias:
npm run build:ios

# Build iOS Device Archive (.xcarchive)
npm run build:ios:archive

# Clean previous build and recompile:
node scripts/build-ios.js --clean
```

### Artifact Outputs (`release/ios/`):
- `release/ios/IndiChat.app` — Standalone compiled iOS application bundle.
- `release/ios/IndiChat-Simulator.zip` — Compressed bundle ready for drag-and-drop onto iOS Simulator.
- `release/ios/icon.png` — High-resolution App Store icon (1024x1024).

---

## 7. Troubleshooting Mobile Issues

| Symptom | Cause | Solution |
|---|---|---|
| `Network request failed` | Incorrect backend IP address | Open Settings in app and enter your computer's current LAN IP (e.g. `http://192.168.0.70:8080`). Ensure phone and PC are on the same Wi-Fi. |
| Socket disconnected (`code 4001`) | Device session revoked | Another session revoked this device from Settings -> Linked Devices. Re-login to create a new session. |
| Gradle build fails: `SDK location not found` | Android SDK missing | Set `ANDROID_HOME=$HOME/Android/Sdk` or configure `apps/mobile/android/local.properties`. |
| Gradle build fails: `Java version mismatch` | Older JDK active | Ensure JDK 17 or 21 is installed and set `JAVA_HOME`. |
| Image upload fails on Android | Binary serialization bug | Ensure `expo-file-system` is used for file uploads instead of standard `FormData`. |
| iOS build requires CocoaPods | Missing `pod` binary | Install via Homebrew: `brew install cocoapods`. |
