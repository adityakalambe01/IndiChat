# AGENTS.md — AI Agent Developer Guide & Operating Manual

> **Welcome, AI Coding Agent!**  
> This file is the primary system operating manual and source of truth for AI agents (Antigravity, Cursor, Copilot, Windsurf, Claude Code, etc.) working on **IndiChat**.  
> Read this entire document before analyzing or modifying any code in this repository.

---

## 1. Project Overview & Mission

**IndiChat** is a production-grade, multi-platform real-time messaging application designed with a WhatsApp/Telegram-class user experience. The system is engineered as a clean, high-performance monorepo composed of:

1. **Backend**: Java 21 & Spring Boot 3.4 modular service (REST APIs + native WebSocket server).
2. **Web Frontend**: React 19 + TypeScript powered by Vite and Vanilla CSS design tokens.
3. **Mobile Frontend**: React Native (0.86+) + Expo (52+) using Expo Router v4 with Android native prebuild and APK/AAB build automation.
4. **Desktop Frontend**: Electron 33+ native Linux client with system tray, embedded proxy, and AppImage/deb/snap distribution.
5. **Shared Types**: `@chat/shared-types` TypeScript package containing cross-platform contracts, DTOs, and WebSocket event payloads.
6. **Infrastructure**: Docker Compose stack containing PostgreSQL 16 (port `5554`), Redis 7 (`6379`), and MinIO S3-compatible Object Storage (`9000`/`9001`).
7. **Release Artifacts**: Automated build scripts that compile and store production release artifacts (`release/android/`, `release/linux/`, etc.).

---

## 2. Monorepo Structure & File Mapping

```
.
├── AGENTS.md                            # You are here — Developer guide for AI agents
├── README.md                            # Human-facing project overview & quickstart
├── docker-compose.yml                   # Postgres, Redis, MinIO, Backend, Web containers
├── .env.example                         # Environment configuration template
├── package.json                         # Monorepo root workspace definitions & orchestration scripts
├── scripts/
│   ├── build-android.js                 # Automated cross-platform Android APK & AAB build engine
│   └── verify_ws.js                     # WebSocket protocol verification script
├── docs/
│   ├── api-contracts.md                 # Complete REST & WebSocket protocol specifications
│   ├── architecture.md                  # High-level architecture, realtime flow & media pipeline
│   ├── database-schema.md               # PostgreSQL schema & Flyway migrations documentation
│   ├── security.md                      # Security model, Passkeys, 2FA, session revocation
│   └── mobile-and-build-guide.md        # Comprehensive Mobile & Android build handbook
├── backend/                             # Spring Boot 3.4 Application
│   ├── pom.xml                          # Maven build definition (Java 21)
│   ├── Dockerfile                       # Multi-stage container build
│   └── src/
│       ├── main/
│       │   ├── java/com/chat/
│       │   │   ├── auth/                # JWT auth, register, login, refresh, logout
│       │   │   ├── config/              # Security, CORS, S3 MinIO, WebSocket config
│       │   │   ├── contact/             # Contact discovery and nicknames
│       │   │   ├── conversation/        # Direct & group chats, membership management
│       │   │   ├── device/              # Linked devices & remote session revocation
│       │   │   ├── file/                # MinIO S3 media upload & streaming download
│       │   │   ├── message/             # Messages, persistence, reactions, replies
│       │   │   ├── notification/        # Device tokens & push notification service
│       │   │   ├── presence/            # Redis-backed online presence & last seen
│       │   │   ├── receipt/             # Sent, Delivered, Read receipts engine
│       │   │   ├── security/            # BCrypt, JwtAuthFilter, CustomUserDetails
│       │   │   ├── settings/            # User settings, 2FA, Passkeys, privacy
│       │   │   ├── user/                # User entity, search, profile updates
│       │   │   └── websocket/           # Native TextWebSocketHandler, real-time routing
│       │   └── resources/
│       │       ├── application.yml      # Spring configuration (ports, data sources, JWT)
│       │       └── db/migration/        # Flyway SQL migrations (V1 through V4+)
├── apps/
│   ├── web/                             # React 19 + TypeScript Web Client
│   │   ├── package.json
│   │   ├── vite.config.ts               # Vite configuration (port 5174/5173, aliases)
│   │   ├── index.html                   # Entry HTML with meta & styling tokens
│   │   └── src/
│   │       ├── App.tsx                  # Root state orchestration & modals
│   │       ├── index.css                # Vanilla CSS design system & tokens (WhatsApp/Telegram aesthetics)
│   │       ├── config/appConfig.ts      # App name & global branding settings
│   │       ├── features/
│   │       │   ├── auth/                # AuthModal (Login, Register, 2FA, Passkeys)
│   │       │   ├── calls/               # CallModal (WebRTC audio/video call interface)
│   │       │   ├── chats/               # ChatSidebar, ChatWindow, EmojiPicker, GIF search
│   │       │   ├── notifications/       # NotificationModal & permission request
│   │       │   └── settings/            # AccountView, LinkedDevicesView, PasskeyModal, etc.
│   │       ├── services/
│   │       │   ├── api.ts               # REST client
│   │       │   ├── callAudio.ts         # Ringtone, dial tone & call sound effects
│   │       │   ├── notifications.ts     # Web notification service
│   │       │   └── settings.ts          # Settings persistence
│   │       └── utils/i18n.ts            # Internationalization dictionaries
│   │
│   └── mobile/                          # React Native 0.86+ / Expo 52+ Mobile Client
│       ├── package.json
│       ├── app.json                     # Expo config (newArchEnabled, android package com.indichat.app)
│       ├── app/                         # Expo Router v4 routes
│       │   ├── _layout.tsx              # Root Stack navigation & theme provider
│       │   ├── index.tsx                # Auth Screen (Login / Register / Passkeys)
│       │   ├── chats.tsx                # Conversations list, Status tab, Calls tab
│       │   ├── settings.tsx             # Full settings screen (Profile, 2FA, Linked Devices)
│       │   └── chat/
│       │       └── [id].tsx             # Full chat room, message bubbles, ticks, media picker
│       ├── components/
│       │   └── StickerView.tsx          # Multi-CDN SVG/PNG sticker component with fallbacks
│       ├── data/
│       │   ├── emojiData.ts             # Emoji categorizations
│       │   ├── gifData.ts               # Dynamic Google Tenor & GIPHY search service
│       │   └── stickerData.ts           # Sticker collection definitions
│       ├── services/
│       │   ├── api.ts                   # REST client + automatic LAN IP deduction
│       │   ├── callHistory.ts           # Local persistent call log storage
│       │   ├── settings.ts              # Mobile user settings synchronization
│       │   ├── storage.ts               # AsyncStorage wrapper
│       │   └── websocket.ts             # Native WebSocket client with auto-reconnect
│       ├── utils/
│       │   ├── device.ts                # Device UUID and platform fingerprinting
│       │   ├── i18n.ts                  # Multi-language translations
│       │   └── timeAgo.ts               # Tiered human-friendly date/time formatting
│       └── android/                     # Prebuilt native Android project (Gradle wrapper, Manifest, ProGuard)
│
├── packages/
│   └── shared-types/                    # Core TypeScript Contracts & Payloads
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts                 # Canonical DTOs, Enums, and WebSocket contracts
│
└── release/                             # Compiled distribution builds
    ├── android/                         # Debug & Release APKs (.apk) and App Bundles (.aab)
    ├── ios/                             # iOS archive placeholders
    ├── windows/                         # Desktop release placeholders
    └── linux/                           # Desktop release placeholders
```

---

## 3. Technology Stack & Core Versions

| Layer | Technologies & Frameworks | Key Versions |
|---|---|---|
| **Backend** | Java, Spring Boot, Spring Security, Spring WebSocket, Spring Data JPA | Java 21, Spring Boot 3.4.0 |
| **Database** | PostgreSQL, Flyway Database Migrations | PostgreSQL 16 Alpine, Flyway Core |
| **Cache & Presence**| Redis (in-memory sessions, presence timestamps, pub/sub) | Redis 7 Alpine |
| **Object Storage** | MinIO (Amazon S3-compatible API) | MinIO Latest (Ports 9000, 9001) |
| **Web Client** | React, TypeScript, Vite, Vanilla CSS | React 19, TypeScript 5.6, Vite 5.4 |
| **Mobile Client** | React Native, Expo, Expo Router | RN 0.86, Expo 52/57, Expo Router 57 |
| **Mobile Build** | Android SDK, Gradle, OpenJDK 17/21 | Gradle 8.8+, CompileSDK 35 |
| **Monorepo** | NPM Workspaces, TypeScript project references | Node.js 20+, npm 10+ |

---

## 4. Fundamental Invariants & Agent Rules of Engagement

When generating or editing code in this workspace, you **MUST** strictly adhere to the following architectural invariants:

### Rule 1: Database Migrations are Append-Only
- **NEVER** modify an existing Flyway migration in `backend/src/main/resources/db/migration/` (e.g., `V1__...`, `V2__...`, `V3__...`, `V4__...`).
- When adding columns, tables, or indexes, **always create a new migration** with the next sequence number: `V<N>__<descriptive_name>.sql`.
- PostgreSQL dialect is used with `TIMESTAMPTZ` for all timestamps and `UUID` with `gen_random_uuid()` for primary keys.

### Rule 2: Shared Types are the Single Source of Truth
- When introducing a new model, payload, or WebSocket event type, **first update `packages/shared-types/src/index.ts`**.
- Both `apps/web` and `apps/mobile` consume `@chat/shared-types`.
- Compile shared types (`npm --workspace=packages/shared-types run build` if building dist) or rely on direct TypeScript source imports.

### Rule 3: Mobile Network & Localhost Routing
- Mobile devices (and Android emulators) **CANNOT connect to `localhost:8080`**.
- Android Emulator routes host machine through `http://10.0.2.2:8080`.
- Physical devices require the host computer's active LAN IP (e.g., `http://192.168.0.70:8080`).
- `apps/mobile/services/api.ts` implements automatic LAN deduction via `Constants.expoConfig?.hostUri`. Keep this fallback chain intact.
- Android Manifest (`apps/mobile/android/app/src/main/AndroidManifest.xml`) must maintain `android:usesCleartextTraffic="true"` to allow local development over HTTP without self-signed TLS errors.

### Rule 4: Delivery Receipts & Read Ticks Semantics
IndiChat enforces standard WhatsApp delivery tick mechanics:
1. **Sent (`status: 'sent'`)**: Message is successfully received and written to PostgreSQL by the backend. Single grey checkmark `✓`.
2. **Delivered (`status: 'delivered'`)**: Recipient's WebSocket connection receives the message and sends `message.delivered`. Two grey checkmarks `✓✓`.
3. **Read (`status: 'read'`)**: Recipient opens the conversation view and sends `message.read`. Two blue/cyan checkmarks `✓✓` (colored `#53bdeb`).
- When a user comes online, the backend (`ChatWebSocketHandler.afterConnectionEstablished`) automatically queries all undelivered messages destined for this user, marks them delivered, and broadcasts `message.receipt.updated` to all senders.

### Rule 5: File & Media Uploads
- Files must be uploaded to the backend via `POST /api/v1/files/upload` as multipart form data.
- In `apps/mobile`, use `expo-file-system` (`uploadAsync` or `ExpoFile`) rather than standard browser `FormData` to prevent React Native Android binary corruption (`Unsupported FormDataPart implementation` error).
- Backend stores the file in MinIO and returns a `FileUploadResponse` containing `fileId`, `fileUrl`, and `fileType`.

### Rule 6: Dynamic GIFs & Multi-CDN Stickers
- Static GIF mock data has been removed. All GIF searches go through `apps/mobile/data/gifData.ts` and `apps/web/src/features/chats/gifData.ts` using Google Tenor and GIPHY live search endpoints.
- Stickers are rendered using `<StickerView>` (`apps/mobile/components/StickerView.tsx`) with fallback CDNs (Telegram CDN, Cloudflare SVG, DiceBear) to guarantee images never break if a single CDN is unreachable.
- Stickers and GIFs are displayed borderless and transparent without white cards or title badges.

### Rule 7: Build Automation Scripts
- Android builds are orchestrated via `scripts/build-android.js`.
- Generated APKs and AABs are automatically copied to `release/android/` with timestamps and git hashes.
- Never manually delete `release/.gitkeep` files in `release/*`.

---

## 5. Environment & Port Allocation

| Component | Default Port | Environment Variable | Notes |
|---|---|---|---|
| PostgreSQL | `5554` (mapped to `5432` internal) | `POSTGRES_PORT` | Mapped to 5554 to avoid collisions with local system Postgres |
| Redis | `6379` | `REDIS_PORT` | Standard Redis port |
| MinIO API | `9000` | `S3_ENDPOINT` | Object storage S3 API |
| MinIO Console | `9001` | - | Web UI for viewing storage buckets (`minioadmin` / `minioadmin`) |
| Spring Boot Backend | `8080` | `PORT` / `SERVER_PORT` | REST API on `/api/v1`, WebSocket on `/ws` |
| Web Application (Vite) | `5174` (or `5173`) | `WEB_PORT` | Configured in `apps/web/vite.config.ts` |
| Expo Metro Bundler | `8081` | - | Standard Expo development server |

---

## 6. How to Run & Validate Each Component

### 1. Launch Infrastructure Services
```bash
# Start Postgres, Redis, MinIO in the background
docker compose up -d postgres redis minio

# Verify services are healthy
docker compose ps
```

### 2. Run Backend (Spring Boot)
```bash
cd backend
# Build JAR skipping unit tests
mvn clean package -DskipTests

# Run Spring Boot
mvn spring-boot:run
# Alternatively run JAR:
# java -jar target/chat-backend-1.0.0.jar
```
*Health Check*: `curl http://localhost:8080/api/v1/auth/login` (should return 400 Bad Request with validation errors, confirming server is alive).

### 3. Run Web Application
```bash
# From workspace root:
npm run web:dev
# Or directly:
npm --workspace=apps/web run dev
```
Open `http://localhost:5174` (or `http://localhost:5173`).

### 4. Run Mobile Application (Expo)
```bash
# From workspace root:
npm run mobile:start

# Run directly on attached Android device / emulator:
npm run mobile:android

# Run on iOS simulator (macOS only):
npm run mobile:ios
```

### 5. Automated Android APK & Bundle Compilation
The build script automatically detects Android SDK and Java 17/21 paths, runs Gradle assemble tasks, and packages binaries into `release/android/`:

```bash
# Build both Debug & Release APKs:
npm run build:android:apk

# Build Google Play App Bundle (.aab):
npm run build:android:bundle

# Build everything with a clean Gradle cache:
node scripts/build-android.js --clean
```
Output files appear in:
`release/android/IndiChat.apk` (or `IndiChat-release-<timestamp>.apk`)  
`release/android/app-release.apk`  
`release/android/IndiChat.aab`

### 6. Automated iOS App & Simulator Compilation
The build script automatically detects Xcode Developer tools, ensures CocoaPods is installed, prebuilds the native iOS workspace, syncs multi-resolution AppIcon assets, and compiles release binaries into `release/ios/`:

```bash
# Build iOS Simulator Release .app bundle (no signing certificates required):
npm run build:ios:sim
# Or alias:
npm run build:ios

# Build iOS Device Archive (.xcarchive):
npm run build:ios:archive

# Clean build and recompile:
node scripts/build-ios.js --clean
```
Output files appear in:
`release/ios/IndiChat.app` — Standalone compiled iOS application bundle  
`release/ios/IndiChat-Simulator.zip` — Compressed bundle ready for iOS Simulator  
`release/ios/icon.png` — 1024x1024 App Store icon

---

## 7. Key Architecture Flows

### A. WebSocket Connection & Lifecycle
```
Client                          ChatWebSocketHandler                        Redis / DB
  |                                      |                                       |
  |--- WS Handshake (/ws?token=JWT) ---->|                                       |
  |                                      |--- Validate JWT & Device ID --------->|
  |                                      |--- presenceService.setUserOnline ---->|
  |                                      |--- Process pending offline receipts ->|
  |<-- { type: "presence.updated" } -----|                                       |
  |<-- { type: "message.receipt.updated"}|                                       |
```

### B. Message Delivery & Receipt Flow
```
Alice (Sender)                Server (WebSocketHandler)             Bob (Recipient)
  |                                      |                                  |
  |-- message.send --------------------->|                                  |
  |   (conversationId, clientMsgId, ...) |                                  |
  |                                      |-- Save to PostgreSQL messages    |
  |<-- message.created (status: sent) ---|                                  |
  |                                      |-- message.created -------------->|
  |                                      |                                  |
  |                                      |<-- message.delivered ------------|
  |<-- message.receipt.updated (dlvrd) --|                                  |
  |                                      |                                  |
  |                                      |<-- message.read -----------------|
  |<-- message.receipt.updated (read) ---|                                  |
```

### C. Multi-Device Session Revocation
When a user visits **Settings -> Linked Devices** and removes an active device session:
1. `DELETE /api/v1/devices/{deviceId}` is invoked.
2. The device record is removed from `user_linked_devices`.
3. `ChatWebSocketHandler.disconnectDevice()` locates the active WebSocket connection matching that device ID.
4. Emits `{ "type": "DEVICE_REMOVED", "payload": { "reason": "..." } }`.
5. Closes the socket with status `4001`. The removed device's client drops back to the authentication screen immediately.

---

## 8. Common Pitfalls & Troubleshooting Guide

| Issue | Root Cause | Solution |
|---|---|---|
| Mobile: `Network request failed` | App trying to reach `localhost:8080` from Android | Ensure backend is listening on LAN. Update `SERVER_URL` in mobile settings or let `getDefaultHost()` detect your LAN IP. |
| Mobile: `Unsupported FormDataPart implementation` | Standard `FormData` used in React Native Expo | Use `expo-file-system` (`uploadAsync` or `ExpoFile`) for multipart file uploads. |
| Flyway: `Migration checksum mismatch` | Existing migration SQL file was modified | Do not edit applied migrations! Add a new `V<N+1>__...sql` migration file. |
| Android Gradle: `SDK location not found` | `ANDROID_HOME` or `local.properties` missing | `scripts/build-android.js` will auto-create `local.properties` pointing to `$HOME/Android/Sdk`. Verify Android SDK is installed. |
| Android Gradle: Java version incompatible | Java 8 or older used for Gradle build | Run with JDK 17 or JDK 21. `scripts/build-android.js` checks candidate JDK locations automatically. |
| Web: `Cannot find module @chat/shared-types` | Monorepo symlinks not resolved | Run `npm install` from root so npm workspaces sets up symlinks in `node_modules`. |
| MinIO: Bucket `chat-attachments` not found | First-time startup without bucket initialization | `FileStorageService` automatically checks and creates the bucket on startup. Verify MinIO is running on port 9000. |

---

## 9. Checklist for Adding New Features

Before concluding any feature or bug fix:
1. [ ] If data models changed, add a new migration `V<N>__<name>.sql` and update entities in `backend`.
2. [ ] If contract changed, update `packages/shared-types/src/index.ts`.
3. [ ] If REST or WebSocket endpoint added/modified, update `docs/api-contracts.md`.
4. [ ] If security rules or settings changed, update `docs/security.md` and `docs/database-schema.md`.
5. [ ] Verify Web builds cleanly: `npm run web:build`.
6. [ ] Verify Mobile TypeScript compiles: `npx tsc --noEmit` inside `apps/mobile`.
7. [ ] Maintain documentation integrity across all docs.
