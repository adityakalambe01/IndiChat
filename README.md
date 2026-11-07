<p align="center">
  <img src="logo/original/icon-128x128.png" alt="IndiChat Logo" width="96" height="96" />
</p>

# IndiChat — Enterprise Real-Time Messaging Platform (Monorepo)

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5%20%2F%203.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java 21](https://img.shields.io/badge/Java-21%2B-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![React](https://img.shields.io/badge/React-18%20%2F%2019-blue.svg)](https://react.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.88-61DAFB.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2058-black.svg)](https://expo.dev/)
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](https://www.electronjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis 7](https://img.shields.io/badge/Redis-7-DC382D.svg)](https://redis.io/)
[![MinIO S3](https://img.shields.io/badge/MinIO-S3%20Storage-C72C48.svg)](https://min.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**IndiChat** is a production-grade, multi-platform real-time messaging ecosystem inspired by WhatsApp and Telegram. Engineered as a high-performance monorepo, IndiChat delivers real-time messaging, WebRTC calling, rich multimedia exchange, dynamic sticker & GIF discovery, multi-device session management, and robust security across Web, Mobile (Android & iOS), Desktop (macOS, Windows & Linux), and Spring Boot backend.

---

## 🚀 Key Features Implemented

### 📱 Mobile Experience (React Native + Expo SDK 58)
- **WhatsApp-Class Native UI**: Full conversational interface with custom header, message bubbles, swipeable replies, and native keyboard avoidance (`KeyboardAvoidingView`).
- **Real-Time Delivery Ticks**: Visual status indicators reflecting live states:
  - `✓` Single grey checkmark: Message persisted to server (Sent).
  - `✓✓` Double grey checkmark: Delivered to recipient's active socket.
  - `✓✓` Double blue checkmark (`#53bdeb`): Read by recipient.
- **Dynamic Google Tenor & GIPHY Search**: Live keyword search with debouncing, infinite scroll pagination, and seamless inline preview (no static mock data).
- **Multi-CDN Sticker Engine (`StickerView`)**: High-performance SVG and PNG sticker rendering with automatic fallback CDNs (Telegram CDN, Cloudflare SVG, DiceBear) ensuring zero broken image icons.
- **Borderless Transparent Media**: Stickers and dynamic GIFs render without card frames, borders, or title badges for a modern look.
- **Native Multipart File Upload**: Built using `expo-file-system` to reliably transmit images, audio voice notes, and documents to MinIO object storage without React Native binary corruption.
- **WebRTC Voice & Video Calling**: Full-screen call flow, ringtones, in-chat call status bubbles, native Android audio routing (`AudioRouteModule.kt` for earpiece/speakerphone management), and persistent local call history logging with human-friendly time formatting.
- **Settings & Privacy Hub**: Profile management, Passkey setup, 2FA PIN security, Linked Devices inspection, Chat backup triggers, and privacy controls.
- **Auto-Deduce Network Host**: Automatically resolves local LAN IP via Expo debugger host so physical devices connect to the local Spring Boot backend seamlessly.
- **Cross-Platform Compilation**: Automated scripts produce Android APK/AAB (`scripts/build-android.js`) and iOS Simulator `.app`/`.zip` and device `.xcarchive` (`scripts/build-ios.js`).

### 🌐 Web Experience (React 18/19 + TypeScript + Vite)
- **Modern Responsive Design**: Dark & light theme aesthetics, sleek glassmorphism, responsive desktop sidebar, and fluid chat viewport.
- **Audio & Call Sound FX**: Dedicated WebRTC call modal with realistic incoming/outgoing ringtones, dial tones, and audio synthesis (`callAudio.ts`).
- **Comprehensive Settings Suite**:
  - **Account & Profile**: Name, avatar, bio, and status updates.
  - **Passkeys (WebAuthn / FIDO2)**: Biometric and hardware security key registration.
  - **Two-Factor Authentication (2FA)**: PIN-based two-factor verification.
  - **Linked Devices**: Real-time list of active browser, mobile, and desktop sessions with remote logout capability.
  - **Chat Backup**: Instant export and snapshot backup management.
  - **Personalization**: Multi-language support (English, Hindi, Spanish, French, etc.) and font size adjustments.
- **Rich Media & Dynamic Search**: Live Tenor & GIPHY picker, emoji categorizations, and drag-and-drop file attachments.

### 🖥️ Desktop Experience (Electron 33+ for macOS, Windows & Linux)
- **Multi-Platform Native Packaging**:
  - **macOS**: Standalone Application bundle, DMG installer, and portable ZIP with native dock and notification support.
  - **Windows**: NSIS installer executable and portable standalone EXE with PE header integrity verification.
  - **Linux**: Universal AppImage (zero install), Debian/Ubuntu `.deb`, Canonical Snap package, portable `.tar.gz`, Flathub Flatpak manifest, XDG desktop entry, and AppStream metadata.
- **Sandboxed Security Runtime**: Renderer process runs with strict security defaults (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`), communicating exclusively via typed `contextBridge` preload.
- **Embedded Local Proxy Engine**: Bundled zero-dependency internal server (`src/server.cjs`) listening strictly on `127.0.0.1` for instant loading and transparent WebSocket/API proxying without CORS restrictions.
- **Desktop System Tray**: Tray icon with instant window toggle, notifications, and native audio/video device permissions.
- **Single-Instance Lock**: Guarantees only one desktop window instance runs, restoring and focusing the active window on subsequent launches.

### ⚙️ Backend Architecture (Java 21 + Spring Boot 3.3.5 / 3.4)
- **Modular Monolith**: Clean domain structure (`auth`, `user`, `conversation`, `message`, `receipt`, `settings`, `device`, `file`, `presence`, `notification`, `websocket`).
- **Native WebSocket Engine (`ChatWebSocketHandler`)**: High-throughput duplex socket handling message routing, typing events, presence broadcasting, and WebRTC signaling.
- **Automatic Offline Delivery Reconciliation**: When an offline user reconnects, undelivered messages are immediately marked as delivered and receipt updates are dispatched to senders.
- **Remote Device Revocation**: Terminating a device session from settings instantly fires a `DEVICE_REMOVED` socket frame, closing the target device's socket with code `4001`.
- **Flyway Database Migrations (V1 to V10)**: Strictly tracked relational schema handling users, conversations, receipts, device tokens, settings, message reactions, starred messages, communities, channels, status stories, passkey credentials, and call logs with strict direction and consistency constraints.
- **MinIO Object Storage**: S3-compliant distributed storage with automatic bucket provisioning, unique file UUID hashing, and streaming download endpoints.
- **Redis Presence & Pub/Sub**: In-memory ephemeral presence tracking, user heartbeat monitoring, and distributed multi-instance routing.

### 📦 Universal Release Orchestration & Build Package Caching
- **Single-Command Multi-Platform Release Runner (`npm run release:all`)**: Orchestrates compilation across Windows, macOS, Linux, iOS, and Android sequentially, writing timestamped build summaries into `release/build-all/<run-id>/summary.json`.
- **Dry-Run Build Planner (`npm run release:plan`)**: Inspects release prerequisites and outputs target plans without modifying files.
- **Project-Local Build Package Caching (`build_run_package/`)**: Localizes toolchains and runtimes (Electron builders, wine packages) inside `build_run_package/` via `npm run packages:status` and `npm run packages:download` for reproducible, offline-friendly builds.
- **Automated Verification Harnesses**: Includes packaged native desktop verification (`npm run test:desktop:packaged`), Linux container smoke tests, and WebSocket integration tests.

---

## 📂 Project Structure

```
├── apps/
│   ├── web/                         # React 18/19 + TypeScript (Vite + Vanilla CSS)
│   ├── mobile/                      # React Native 0.88 + Expo SDK 58 (Expo Router v4)
│   │   ├── android/                 # Prebuilt native Android project (Gradle, Manifest)
│   │   └── ios/                     # Native iOS workspace (CocoaPods, Assets)
│   └── desktop/                     # Electron 33+ Desktop Client (macOS, Windows, Linux)
├── backend/                         # Java 21 & Spring Boot 3.3.5/3.4 Application
│   ├── src/main/java/com/chat/      # Modular domains (auth, conversation, message, etc.)
│   └── src/main/resources/
│       ├── application.yml          # Spring configuration & data sources
│       └── db/migration/            # Flyway SQL migrations (V1 through V10)
├── packages/
│   └── shared-types/                # Cross-platform TypeScript DTOs & WebSocket contracts
├── docs/                            # Complete technical documentation suite
│   ├── api-contracts.md             # REST endpoints & WebSocket frame specifications
│   ├── architecture.md              # System architecture, data flow & media pipelines
│   ├── database-schema.md           # PostgreSQL schema & Flyway migrations (V1 to V10)
│   ├── security.md                  # Security policies, Passkeys, 2FA, sandboxing
│   ├── mobile-and-build-guide.md    # Mobile development, Expo router & native builds
│   ├── linux-desktop-and-store-guide.md # Desktop Linux packaging & store distribution
│   ├── development/                 # Engineering standards, lifecycle & verification
│   └── testing/                     # Verification records, call defect analyses & test runners
├── build_run_package/               # Local cached build toolchains & package runtimes
├── preview/                         # Interactive design preview & automated visual verification
├── release/                         # Production release binary storage
│   ├── android/                     # Output APKs (.apk) and App Bundles (.aab)
│   ├── ios/                         # Output Simulator .app/.zip and Device .xcarchive
│   ├── macos/                       # Output DMG installer and portable ZIP
│   ├── windows/                     # Output NSIS installer and portable EXE
│   ├── linux/                       # Output AppImage, .deb, .snap, .tar.gz
│   └── build-all/                   # Multi-platform release run summaries
├── scripts/                         # Multi-platform build and verification engines
│   ├── build-all-releases.cjs       # Universal release orchestrator
│   ├── build-android.js             # Android APK and Bundle build engine
│   ├── build-ios.js                 # iOS simulator and archive build engine
│   ├── build-macos.js               # macOS DMG and ZIP build engine
│   ├── build-windows.js             # Windows NSIS and Portable build engine
│   ├── build-linux.js               # Linux AppImage, DEB, Snap build engine
│   ├── setup-build-packages.js      # Project-local build cache manager
│   ├── test-packaged-macos-native.cjs # Native desktop smoke test suite
│   └── verify_ws.js                 # WebSocket protocol test runner
├── docker-compose.yml               # Postgres 16, Redis 7, MinIO, Backend, Web containers
├── AGENTS.md                        # AI coding agent operating manual and system prompt
└── package.json                     # Monorepo root workspaces & npm run orchestrator
```

---

## 🛠️ Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20+ with `npm` 10+
- **JDK**: Java 21 (Temurin or OpenJDK recommended)
- **Maven**: 3.9+ (or use containerized Maven wrapper via `npm run backend:build`)
- **Docker & Docker Compose**: For PostgreSQL, Redis, and MinIO
- **Android SDK** *(optional, for native Android builds)*: API Level 34/35
- **Xcode & CocoaPods** *(optional, for native iOS builds on macOS)*: Xcode 16+

---

### 2. Infrastructure Services (Docker)
Start the PostgreSQL database, Redis caching layer, and MinIO object storage:

```bash
docker compose up -d postgres redis minio
```

Verify service health:
```bash
docker compose ps
```
- **PostgreSQL**: `localhost:5554` (Database: `chat_platform`, User: `postgres`, Pass: `postgres`)
- **Redis**: `localhost:6379`
- **MinIO Console**: `http://localhost:9001` (User: `minioadmin`, Pass: `minioadmin`)
- **MinIO S3 API**: `http://localhost:9000`

---

### 3. Spring Boot Backend
```bash
cd backend
mvn clean package -DskipTests
mvn spring-boot:run
```
*(Or use containerized build from workspace root: `npm run backend:build && npm run backend:run`)*.

The backend initializes on `http://localhost:8080`. Flyway automatically runs database migrations (`V1` through `V10`).

---

### 4. Web Application (React + Vite)
In a new terminal:
```bash
# Install all monorepo dependencies from root
npm install

# Start Vite dev server
npm run web:dev
```
Access the web client at `http://localhost:5174` (or `http://localhost:5173`).

---

### 5. Mobile Application (React Native + Expo)
In a new terminal:
```bash
# Start Expo development server (Metro bundler)
npm run mobile:start
```
- **Run on Android device or emulator**: Press `a` in the terminal or run `npm run mobile:android`.
- **Run on iOS simulator**: Press `i` in the terminal or run `npm run mobile:ios`.
- **Run on physical device**: Scan the QR code with **Expo Go** or install the generated APK.

> **Note on Mobile API Connectivity**:  
> When testing on a physical phone or external device, the app connects to your machine's LAN IP (e.g. `http://192.168.0.70:8080`). You can customize the server URL directly inside the mobile app via **Settings -> Network Configuration**.

---

### 6. Desktop Application (Electron)
In a new terminal:
```bash
# Start desktop app in development mode
npm run desktop:linux
# Or general start:
npm run desktop:start
```

---

## 🏗️ Automated Multi-Platform Release Builds

IndiChat provides automated, zero-configuration build engines for all supported platforms:

### 🌐 Universal Multi-Platform Runner
Build releases across all five target platforms in a single command:

```bash
# 1. Preview the build plan without modifying files:
npm run release:plan

# 2. Build all platforms (Windows, macOS, Linux, iOS, Android):
npm run release:all

# 3. Build all platforms but omit the signed iOS device archive (simulator only):
npm run release:all -- --ios-simulator-only

# 4. Build selected target platforms:
npm run release:all -- --platforms=macos,linux
npm run release:all -- --platforms=windows,android
```

The runner logs progress, enforces that fresh artifacts are produced, and writes a detailed run summary to `./release/build-all/<run-id>/summary.json`.

---

### 🤖 Mobile Releases (Android & iOS)

```bash
# Android: Build both Debug & Release APKs:
npm run build:android:apk
# Outputs: release/android/IndiChat.apk, release/android/app-release.apk

# Android: Build Google Play App Bundle (.aab):
npm run build:android:bundle
# Output: release/android/IndiChat.aab

# iOS: Build Simulator Release Bundle (.app and .zip):
npm run build:ios:sim
# Outputs: release/ios/IndiChat.app, release/ios/IndiChat-Simulator.zip

# iOS: Build Device Archive (.xcarchive):
npm run build:ios:archive
# Output: release/ios/IndiChat.xcarchive
```

---

### 🖥️ Desktop Releases (macOS, Windows, Linux)

```bash
# macOS: Build DMG installer & portable ZIP:
npm run build:macos
npm run build:macos:dmg
npm run build:macos:zip
# Outputs: release/macos/IndiChat-<version>-arm64.dmg, release/macos/IndiChat-<version>-mac.zip

# Windows: Build NSIS installer & portable EXE:
npm run build:windows
npm run build:windows:nsis
npm run build:windows:portable
# Outputs: release/windows/IndiChat-Setup-<version>.exe, release/windows/IndiChat-<version>-portable.exe

# Linux: Build AppImage, Debian .deb, Snap & tar.gz:
npm run build:linux
npm run build:linux:appimage
npm run build:linux:deb
npm run build:linux:snap
# Outputs: release/linux/IndiChat-<version>.AppImage, release/linux/indichat_<version>_amd64.deb
```

---

### 📦 Project-Local Build Toolchain Caching (`build_run_package/`)

To ensure build reproducibility and reduce network dependency during packaging, toolchain packages and runtimes are localized in `build_run_package/`:

```bash
# Inspect status of cached build toolchains:
npm run packages:status

# Pre-download all toolchain dependencies for offline packaging:
npm run packages:download
```

---

## 📜 Complete NPM Scripts Reference

| Command | Description |
|---|---|
| `npm run web:dev` | Launch Web client with Vite hot module replacement (port 5174) |
| `npm run web:build` | Build production bundle for Web application (`apps/web/dist/`) |
| `npm run db:seed` | Seed development database with demo contacts and sample chats |
| `npm run verify:users` | Verify existence and credentials of all seeded demo accounts |
| `npm run verify:ws` | Execute automated WebSocket protocol and receipt validation test |
| `npm run sync:logos` | Synchronize platform logos across Web, Mobile, Desktop, and Release |
| `npm run mobile:start` | Start Expo Metro bundler for mobile development |
| `npm run mobile:android` | Compile and launch Android native development build |
| `npm run mobile:ios` | Compile and launch iOS simulator build |
| `npm run desktop:linux` | Launch Electron Desktop client in development mode |
| `npm run desktop:start` | Start Electron Desktop client |
| `npm run packages:status` | Check status of cached toolchain binaries in `build_run_package/` |
| `npm run packages:download` | Download and cache all build packaging dependencies locally |
| `npm run release:plan` | Preview multi-platform release plan without running builds |
| `npm run release:all` | Run complete multi-platform release build across all 5 platforms |
| `npm run build:android` | Execute Android build automation script (all artifacts) |
| `npm run build:android:apk` | Compile standalone `.apk` binaries for Android |
| `npm run build:android:bundle` | Compile production `.aab` Google Play bundle |
| `npm run build:ios` | Execute iOS build automation script (simulator targets) |
| `npm run build:ios:sim` | Compile iOS simulator `.app` and `.zip` distribution bundles |
| `npm run build:ios:archive` | Compile iOS native `.xcarchive` device bundle |
| `npm run build:macos` | Build macOS desktop distribution packages (DMG & ZIP) |
| `npm run build:macos:dmg` | Build macOS `.dmg` installer disk image |
| `npm run build:macos:zip` | Build macOS portable `.zip` application archive |
| `npm run build:windows` | Build Windows desktop packages (NSIS & Portable) |
| `npm run build:windows:nsis` | Build Windows NSIS setup installer (`.exe`) |
| `npm run build:windows:portable`| Build Windows portable standalone executable (`.exe`) |
| `npm run build:linux` | Build standard Linux distribution packages (AppImage, deb, tar.gz) |
| `npm run build:linux:appimage` | Build standalone universal Linux AppImage |
| `npm run build:linux:deb` | Build Debian / Ubuntu `.deb` package |
| `npm run build:linux:snap` | Build Canonical Snap package for Ubuntu App Center |
| `npm run build:linux:tar` | Build portable Linux compressed `.tar.gz` archive |
| `npm run build:linux:all` | Build all Linux release package formats |
| `npm run test:desktop:packaged`| Run native smoke test suite against packaged desktop app |
| `npm run backend:build` | Build Spring Boot JAR via containerized Maven wrapper |
| `npm run backend:test` | Run Spring Boot unit & integration tests |
| `npm run backend:run` | Run compiled Spring Boot JAR (`backend/target/chat-backend-1.0.0.jar`) |

---

## 📡 Real-Time WebSocket Protocol

WebSocket connection endpoint: `ws://<host>:8080/ws?token=<jwt_token>`

### Core Action Types
- `message.send` — Transmit chat message (text, media attachment, sticker, GIF, or call).
- `message.created` — Broadcast persisted message to all conversation participants.
- `message.delivered` — Recipient socket acknowledges receipt of message.
- `message.read` — Recipient opens conversation triggering blue read ticks.
- `message.receipt.updated` — Broadcast delivery and read timestamps to senders.
- `typing.start` / `typing.stop` — Real-time typing indicators.
- `presence.subscribe` / `presence.updated` — Live online / offline state and last seen timestamps.
- `call.signal` — WebRTC signaling peer exchange (offer, answer, ICE candidate, hangup).
- `message.reaction.updated` — Real-time emoji reaction broadcast across conversation members.
- `DEVICE_REMOVED` — Server notifies client that its session was revoked remotely (closes socket with code `4001`).

---

## 📚 Technical Documentation Index

Detailed architectural and technical guides are available in the [`docs/`](docs/) directory:

- 📖 **[AI Agent Operating Manual](AGENTS.md)**: Rules, invariants, and guidelines for AI coding agents.
- 📖 **[System Architecture](docs/architecture.md)**: Monorepo diagram, real-time pipeline, media flow & build engines.
- 📖 **[API Contracts & WebSocket Protocol](docs/api-contracts.md)**: Complete REST endpoints and WebSocket frames.
- 📖 **[Database Schema & Migrations](docs/database-schema.md)**: Flyway migrations (V1 through V10), relationships, and indexes.
- 📖 **[Security Architecture](docs/security.md)**: Passkeys, 2FA PIN, device sessions, and desktop renderer sandboxing.
- 📖 **[Mobile & Android Build Guide](docs/mobile-and-build-guide.md)**: Expo router, native prebuild, WebRTC audio routing, and APK/iOS automation.
- 📖 **[Linux Desktop & App Store Guide](docs/linux-desktop-and-store-guide.md)**: Flathub, Snap Store, and AppImage distribution.
- 📖 **[Engineering Playbook & Lifecycle](docs/development/DEVELOPMENT_LIFECYCLE.md)**: Phase-based engineering lifecycle standards.
- 📖 **[Project Context & Invariants](docs/development/PROJECT_CONTEXT.md)**: Port allocations, build commands, and repository invariants.
- 📖 **[Desktop Multi-Platform Verification Plan](docs/development/desktop-multi-platform-verification-plan.md)**: Cross-platform desktop testing strategy.
- 📖 **[Multi-Platform Release Runner Guide](docs/testing/release-all-runner.md)**: Verification and orchestration specs for `release:all`.

---

## 📄 License & Attribution

- **License**: This project is licensed under the MIT License — see the [`LICENSE`](LICENSE) file for details.
- **Third-Party Notices**: For complete third-party dependency licenses and trademark notices, see [`NOTICE.md`](NOTICE.md).
- **Author & Copyright Holder**: [Aditya Kalambe](https://github.com/adityakalambe01) ([@adityakalambe01](https://github.com/adityakalambe01)) — Copyright © 2026.
