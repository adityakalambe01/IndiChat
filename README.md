<p align="center">
  <img src="logo/original/icon-128x128.png" alt="IndiChat Logo" width="96" height="96" />
</p>

# IndiChat — Enterprise Real-Time Messaging Platform (Monorepo)

[![Spring Boot 3.4](https://img.shields.io/badge/Spring%20Boot-3.4.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java 21](https://img.shields.io/badge/Java-21%2B-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![React 19](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB.svg)](https://reactnative.dev/)
[![Expo 52](https://img.shields.io/badge/Expo-52%2F57-black.svg)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis 7](https://img.shields.io/badge/Redis-7-DC382D.svg)](https://redis.io/)
[![MinIO S3](https://img.shields.io/badge/MinIO-S3%20Storage-C72C48.svg)](https://min.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**IndiChat** is a production-grade, multi-platform real-time messaging ecosystem inspired by WhatsApp and Telegram. Engineered as a high-performance monorepo, IndiChat delivers real-time messaging, WebRTC calling, rich multimedia exchange, dynamic sticker & GIF discovery, multi-device session management, and robust security across Web, Mobile (Android & iOS), and Spring Boot backend.

---

## 🚀 Key Features Implemented

### 📱 Mobile Experience (React Native + Expo)
- **WhatsApp-Class Native UI**: Full conversational interface with custom header, message bubbles, swipeable replies, and native keyboard avoidance (`KeyboardAvoidingView`).
- **Real-Time Delivery Ticks**: Visual status indicators reflecting live states:
  - `✓` Single grey checkmark: Message persisted to server (Sent).
  - `✓✓` Double grey checkmark: Delivered to recipient's active socket.
  - `✓✓` Double blue checkmark: Read by recipient.
- **Dynamic Google Tenor & GIPHY Search**: Live keyword search with debouncing, infinite scroll pagination, and seamless inline preview (no static mock data).
- **Multi-CDN Sticker Engine (`StickerView`)**: High-performance SVG and PNG sticker rendering with automatic fallback CDNs (Telegram CDN, Cloudflare SVG, DiceBear) ensuring zero broken image icons.
- **Borderless Transparent Media**: Stickers and dynamic GIFs render without card frames, borders, or title badges for a modern look.
- **Native Multipart File Upload**: Built using `expo-file-system` to reliably transmit images, audio voice notes, and documents to MinIO object storage without React Native binary corruption.
- **Audio & Video Call Hub**: Full-screen call flow, ringtones, in-chat call status bubbles, and persistent local call history logging with tiered human-friendly time formatting.
- **Settings & Privacy Hub**: Profile management, Passkey setup, 2FA PIN security, Linked Devices inspection, Chat backup triggers, and privacy controls.
- **Auto-Deduce Network Host**: Automatically resolves local LAN IP via Expo debugger host so physical devices connect to the local Spring Boot backend seamlessly.

### 🌐 Web Experience (React 19 + TypeScript + Vite)
- **Modern Responsive Design**: Dark & light theme aesthetics, sleek glassmorphism, responsive desktop sidebar, and fluid chat viewport.
- **Audio & Call Sound FX**: Dedicated WebRTC call modal with realistic incoming/outgoing ringtones, dial tones, and audio synthesis (`callAudio.ts`).
- **Comprehensive Settings Suite**:
  - **Account & Profile**: Name, avatar, bio, and status updates.
  - **Passkeys (WebAuthn)**: Biometric and hardware key registration.
  - **Two-Factor Authentication (2FA)**: PIN-based two-factor verification.
  - **Linked Devices**: Real-time list of active browser and mobile sessions with remote logout capability.
  - **Chat Backup**: Instant export and snapshot backup management.
  - **Personalization**: Multi-language support (English, Hindi, Spanish, French, etc.) and font size adjustments.
- **Rich Media & Dynamic Search**: Live Tenor & GIPHY picker, emoji categorizations, and drag-and-drop file attachments.

### ⚙️ Backend Architecture (Java 21 + Spring Boot 3.4)
- **Modular Monolith**: Clean domain structure (`auth`, `user`, `conversation`, `message`, `receipt`, `settings`, `device`, `file`, `presence`, `notification`, `websocket`).
- **Native WebSocket Engine (`ChatWebSocketHandler`)**: High-throughput duplex socket handling message routing, typing events, presence broadcasting, and WebRTC signaling.
- **Automatic Offline Delivery Reconciliation**: When an offline user reconnects, undelivered messages are immediately marked as delivered and receipt updates are dispatched to senders.
- **Remote Device Revocation**: Terminating a device session from settings instantly fires a `DEVICE_REMOVED` socket frame, closing the target device's socket with code `4001`.
- **Flyway Database Migrations**: Strictly tracked relational schema from V1 through V4+ handling users, conversations, receipts, device tokens, and settings.
- **MinIO Object Storage**: S3-compliant distributed storage with automatic bucket provisioning, unique file UUID hashing, and streaming download endpoints.
- **Redis Presence & Pub/Sub**: In-memory ephemeral presence tracking, user heartbeat monitoring, and distributed multi-instance routing.

### 🖥️ Linux Desktop & App Store Distribution (Electron + React 19)
- **Native Linux Application**: High-performance Electron desktop client with hardware-accelerated Wayland & X11 rendering and single-instance lock.
- **Embedded Local Proxy Engine**: Bundled zero-dependency internal server (`src/server.cjs`) for instant loading and transparent WebSocket/API proxying without CORS restrictions.
- **Desktop System Tray**: Tray icon with instant window toggle, notifications, and native audio/video device permissions.
- **Multi-Format Store Packages**: Ready-to-publish packages generated for Canonical Snap Store, Flathub, and AppImageHub.

### 📦 Build Automation & Cross-Platform Releases
- **Automated Android Build Engine (`scripts/build-android.js`)**: Single-command compilation of Debug APKs, Release APKs, and Google Play App Bundles (.aab).
- **Automated Linux Build Engine (`scripts/build-linux.js`)**: Single-command compilation of universal AppImages, Debian/Ubuntu `.deb`, portable `.tar.gz`, and Snap packages into `release/linux/`.
- **Automated Environment Resolution**: Automatically locates Android SDK and Java 17/21 paths, manages `local.properties`, verifies Gradle execution rights, and saves artifacts into `release/android/`.

---

## 📂 Project Structure

```
├── apps/
│   ├── web/                         # React 19 + TypeScript (Vite + Vanilla CSS)
│   ├── mobile/                      # React Native 0.86 + Expo 52 (Expo Router v4)
│   │   └── android/                 # Prebuilt native Android project (Gradle, Manifest)
│   └── desktop/                     # Electron Desktop Client (Linux AppImage, deb, snap)
├── backend/                         # Java 21 & Spring Boot 3.4 Application
│   ├── src/main/java/com/chat/      # Controllers, Services, Repositories, Entities
│   └── src/main/resources/
│       ├── application.yml          # Spring configuration & profiles
│       └── db/migration/            # Flyway SQL migrations (V1 to V4)
├── packages/
│   └── shared-types/                # Cross-platform TypeScript DTOs & WebSocket contracts
├── docs/                            # In-depth system and technical documentation
│   ├── api-contracts.md             # Complete REST endpoints & WebSocket protocol
│   ├── architecture.md              # System architecture, data flow & media pipelines
│   ├── database-schema.md           # PostgreSQL schema & Flyway migrations
│   ├── security.md                  # Security policies, Passkeys, 2FA, session revocation
│   └── mobile-and-build-guide.md    # Mobile development & Android build guide
├── scripts/
│   ├── build-android.js             # Automated cross-platform Android build script
│   └── verify_ws.js                 # WebSocket protocol test runner
├── release/                         # Production release binary storage
│   ├── android/                     # Output APKs and AABs
│   ├── ios/                         # iOS archive storage
│   ├── windows/                     # Desktop builds
│   └── linux/                       # Linux builds
├── docker-compose.yml               # Postgres 16, Redis 7, MinIO, Backend, Web containers
├── AGENTS.md                        # AI coding agent operating manual and system prompt
└── package.json                     # Monorepo workspaces & task runner
```

---

## 🛠️ Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20+ with `npm` 10+
- **JDK**: Java 21 (Temurin or OpenJDK recommended)
- **Maven**: 3.9+ (or use Docker Maven wrapper)
- **Docker & Docker Compose**: For PostgreSQL, Redis, and MinIO
- **Android SDK** *(optional, for native mobile builds)*: API Level 34/35

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
The backend initializes on `http://localhost:8080`. Flyway automatically runs database migrations (`V1` through `V4`).

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
- **Run on physical device**: Scan the QR code with **Expo Go** or install the generated debug APK.

> **Note on Mobile API Connectivity**:  
> When testing on a physical phone or external device, the app connects to your machine's LAN IP (e.g. `http://192.168.0.70:8080`). You can customize the server URL directly inside the mobile app via **Settings -> Network Configuration**.

---

## 🤖 Android APK & AAB Automated Build Guide

IndiChat includes a zero-configuration automated build script (`scripts/build-android.js`) that handles Android SDK path resolution, Gradle permissions, and artifact packaging.

### Android Build Commands

```bash
# 1. Build both Debug and Release APKs:
npm run build:android:apk

# 2. Build Google Play App Bundle (.aab):
npm run build:android:bundle

# 3. Build all artifacts with Gradle clean:
node scripts/build-android.js --clean
```

### Android Release Outputs

Compiled binaries are automatically copied into the `release/android/` directory:
- `release/android/IndiChat-release-<timestamp>.apk` — Ready for sideloading on any Android device
- `release/android/IndiChat-debug-<timestamp>.apk` — Debuggable build with developer tools enabled
- `release/android/IndiChat-release-<timestamp>.aab` — Production bundle for Google Play Console

---

## 🖥️ Linux Desktop & Store Distribution Guide

IndiChat includes automated packaging for all major Linux distributions and software stores via [`scripts/build-linux.js`](scripts/build-linux.js).

### Linux Desktop Build Commands

```bash
# 1. Build all primary Linux packages (AppImage, deb, tar.gz):
npm run build:linux

# 2. Build AppImage standalone executable only:
npm run build:linux:appimage

# 3. Build Debian / Ubuntu .deb package only:
npm run build:linux:deb

# 4. Build Snap package for Canonical Snap Store:
npm run build:linux:snap
```

### Linux Release Outputs & Store Manifests
Compiled Linux binaries and store manifests are stored in `release/linux/`:
- `release/linux/IndiChat-1.0.0.AppImage` — Standalone universal Linux binary (run without install)
- `release/linux/indichat_1.0.0_amd64.deb` — Native Debian / Ubuntu package (`sudo dpkg -i ...`)
- `release/linux/IndiChat-1.0.0.tar.gz` — Portable compressed application archive
- `release/linux/indichat.desktop` — XDG desktop entry shortcut
- `release/linux/org.indichat.IndiChat.metainfo.xml` — AppStream metadata for Flathub, GNOME Software, KDE Discover
- `release/linux/org.indichat.IndiChat.yml` — Flatpak packaging manifest
- `release/linux/snapcraft.yaml` — Canonical Snap Store build recipe

---

## 📜 Complete NPM Scripts Reference

| Command | Description |
|---|---|
| `npm run web:dev` | Launch Web client with Vite hot module replacement |
| `npm run web:build` | Build production bundle for Web application |
| `npm run sync:logos` | Synchronize platform logos across Web, Mobile, Desktop, and Release |
| `npm run mobile:start` | Start Expo Metro bundler for mobile development |
| `npm run mobile:android`| Compile and launch Android native development build |
| `npm run mobile:ios` | Compile and launch iOS simulator build |
| `npm run desktop:linux` | Launch Linux Desktop client in development mode |
| `npm run build:linux` | Build all Linux release packages (AppImage, deb, tar.gz) |
| `npm run build:linux:appimage` | Build standalone universal Linux AppImage |
| `npm run build:linux:deb` | Build Debian / Ubuntu `.deb` package |
| `npm run build:linux:snap` | Build Canonical Snap package for Ubuntu App Center |
| `npm run build:android` | Execute Android build automation script (all artifacts) |
| `npm run build:android:apk` | Compile standalone `.apk` binaries for Android |
| `npm run build:android:bundle` | Compile production `.aab` Google Play bundle |
| `npm run backend:build` | Build Spring Boot JAR via Docker Maven wrapper |
| `npm run backend:run` | Run compiled Spring Boot JAR |

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
- `DEVICE_REMOVED` — Server notifies client that its session was revoked remotely.

---

## 📚 Technical Documentation Index

Detailed architectural and technical guides are available in the [`docs/`](docs/) directory:

- 📖 **[AI Agent Operating Manual](AGENTS.md)**: Rules, invariants, and guidelines for AI coding agents.
- 📖 **[Linux Desktop & App Store Guide](docs/linux-desktop-and-store-guide.md)**: Flathub, Snap Store, and AppImage distribution.
- 📖 **[API Contracts & WebSocket Protocol](docs/api-contracts.md)**: Full REST endpoints and WebSocket frames.
- 📖 **[System Architecture](docs/architecture.md)**: Monorepo diagram, real-time pipeline, and media flow.
- 📖 **[Database Schema & Migrations](docs/database-schema.md)**: Flyway migrations (V1–V4), table relationships, and indexes.
- 📖 **[Security Architecture](docs/security.md)**: Passkeys, 2FA PIN, device sessions, and Android network security.
- 📖 **[Mobile & Android Build Guide](docs/mobile-and-build-guide.md)**: Expo router, native prebuild, and APK automation.

---

## 📄 License & Attribution

- **License**: This project is licensed under the MIT License — see the [`LICENSE`](LICENSE) file for details.
- **Third-Party Notices**: For complete third-party dependency licenses and trademark notices, see [`NOTICE.md`](NOTICE.md).
- **Author & Copyright Holder**: [Aditya Kalambe](https://github.com/adityakalambe01) ([@adityakalambe01](https://github.com/adityakalambe01)) — Copyright © 2026.
