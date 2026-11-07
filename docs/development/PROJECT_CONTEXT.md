# Project Context: IndiChat Messaging Platform

> **Repository Profile & Operating Context**  
> This document instantiates the [16_PROJECT_CONTEXT_TEMPLATE.md](./16_PROJECT_CONTEXT_TEMPLATE.md) for **IndiChat**, providing AI agents and human engineers with the active ports, build commands, and non-negotiable repository invariants.

---

## 1. System Overview
- **Repository Name**: `chat-platform` (IndiChat)
- **Primary Domain**: Production-grade real-time messaging platform (WhatsApp / Telegram class)
- **Architecture**: Monorepo managed with npm workspaces
- **Primary Languages**: TypeScript 5.6, Java 21, SQL (PostgreSQL dialect)
- **Primary Frameworks**: React 18/19 (Web), Expo SDK 58 / React Native 0.88 (Mobile), Electron 33+ (Desktop), Spring Boot 3.3.5 / 3.4 (Backend)

---

## 2. Infrastructure & Port Allocations
| Service / Component | Port | Environment Variable | Notes |
|---|---|---|---|
| PostgreSQL 16 | `5554` | `POSTGRES_PORT` | Mapped to `5554` to avoid collision with local system Postgres (internal 5432) |
| Redis 7 | `6379` | `REDIS_PORT` | In-memory presence, last-seen timestamps, pub/sub |
| MinIO API | `9000` | `S3_ENDPOINT` | Amazon S3-compatible object storage for attachments |
| MinIO Web Console | `9001` | - | Admin storage console. Default credentials (`minioadmin` / `minioadmin`) are strictly for local offline development and forbidden in production. Production environments must inject strong, separately managed credentials via `S3_ACCESS_KEY` and `S3_SECRET_KEY` from a secrets manager. |
| Spring Boot Backend | `8080` | `PORT` / `SERVER_PORT` | REST API on `/api/v1`, WebSocket server on `/ws` |
| Web Client (Vite) | `5174` | `WEB_PORT` | Dev server (or 5173 fallback) configured in `apps/web/vite.config.ts` |
| Expo Metro Bundler | `8081` | - | React Native / Expo development bundler |

---

## 3. Canonical Engineering Commands

### Build & Validation
```bash
# 1. Install root workspace dependencies and symlinks
npm install

# 2. Build Web client (Typecheck + Vite production bundle)
npm run web:build

# 3. Validate Mobile TypeScript compilation
cd apps/mobile && npx tsc --noEmit

# 4. Build Spring Boot Backend JAR (Uses containerized Maven wrapper or local Maven)
npm run backend:build
# Or directly if Java 21 / Maven is installed locally:
cd backend && mvn clean package -DskipTests

# 5. Build Desktop Distribution Packages
# macOS (DMG & ZIP):
npm run build:macos
# Windows (NSIS & Portable EXE):
npm run build:windows
# Linux (AppImage, DEB, Snap):
npm run build:linux
```

### Testing & Verification
```bash
# Backend Unit & Integration Tests (Containerized Maven)
npm run backend:test
# Or directly if Java 21 / Maven is installed locally:
cd backend && mvn test

# Web Frontend Tests
npm --workspace=apps/web run test --if-present

# Real-time WebSocket Protocol Verification (Requires running backend on port 8080)
npm run verify:ws

# Desktop Packaged App Native Smoke Tests
npm run test:desktop:packaged

# Toolchain Package Caching Status
npm run packages:status
```

### Local Development Runtime
```bash
# Start background infrastructure (Postgres, Redis, MinIO)
docker compose up -d postgres redis minio

# Start Spring Boot backend
npm run backend:run
# Or run with Maven dev server:
cd backend && mvn spring-boot:run

# Start Web dev server
npm run web:dev

# Start Mobile Expo bundler
npm run mobile:start

# Start Desktop client
npm run desktop:linux
```

### Multi-Platform Packaging & Release Orchestration
```bash
# Preview complete multi-platform release plan (dry-run):
npm run release:plan

# Execute release build across all 5 target platforms:
npm run release:all

# Mobile Android: Compile Release APK and Google Play Bundle (.aab)
npm run build:android:apk
npm run build:android:bundle

# Mobile iOS: Compile Simulator Bundle and Device Archive (.xcarchive)
npm run build:ios:sim
npm run build:ios:archive
```

---

## 4. Fundamental Repository Invariants

1. **Database Migrations are Append-Only**:
   - Never modify existing Flyway migrations in [backend/src/main/resources/db/migration/](../../backend/src/main/resources/db/migration/) (V1 through V10).
   - Always create a new sequence `V<N>__<name>.sql` using PostgreSQL dialect with `TIMESTAMPTZ` and `gen_random_uuid()`.
   - **Flyway Version & Concurrent Indexing Support**: The backend uses Flyway Community Edition 10.x (managed by Spring Boot `org.flywaydb:flyway-core`). Per-migration script configuration files (`V<N>__<name>.sql.conf`) containing `executeInTransaction=false` are supported. When applied, Flyway disables transaction wrapping for that script, allowing PostgreSQL to execute `CREATE INDEX CONCURRENTLY`.
   - **Concurrent Index Failure Caveat**: Because execution occurs outside a transaction, if concurrent index creation fails, PostgreSQL leaves an `INVALID` index on disk. The engineer must manually drop the invalid index (`DROP INDEX CONCURRENTLY IF EXISTS <name>;`) and repair the Flyway history table before retrying (`mvn flyway:repair -Dflyway.url=jdbc:postgresql://localhost:5554/chat_platform -Dflyway.user=postgres -Dflyway.password=postgres`). Standard transactional `CREATE INDEX` remains the default for all regular migrations unless concurrent indexing is explicitly justified.
2. **Shared Types are Single Source of Truth**:
   - All cross-platform contracts, DTOs, and WebSocket event payloads must be defined in [packages/shared-types/src/index.ts](../../packages/shared-types/src/index.ts).
3. **Mobile Network & Localhost Routing**:
   - Android devices and emulators cannot connect to `localhost:8080`.
   - Android Emulator connects via `http://10.0.2.2:8080`.
   - Physical devices connect via host machine LAN IP (e.g., `http://192.168.x.x:8080`).
   - Keep dynamic host deduction intact in `apps/mobile/services/api.ts`.
4. **WebSocket Authentication & Log Redaction**:
   - Native Mobile/Desktop clients should supply `Authorization` handshake headers where supported.
   - Any reverse proxies or web server access logs in production must explicitly redact query parameter values for `token`.
5. **Delivery Receipts & Read Ticks**:
   - Sent (`sent`): 1 grey checkmark `✓`
   - Delivered (`delivered`): 2 grey checkmarks `✓✓`
   - Read (`read`): 2 cyan/blue checkmarks `✓✓` (`#53bdeb`).
6. **Multipart Uploads in React Native**:
   - Do NOT use standard browser `FormData` in React Native Expo Android. Use `expo-file-system` (`uploadAsync` or `ExpoFile`) to prevent binary corruption crashes.
7. **Desktop Renderer Sandboxing**:
   - Electron windows must enforce `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`. Preload scripts expose strictly whitelisted APIs via `contextBridge`.
   - Embedded proxy (`src/server.cjs`) binds exclusively to loopback `127.0.0.1`.
