# Security Architecture & Policies

This document outlines the security controls, authentication mechanisms, session governance, desktop runtime sandboxing, and data protection policies implemented in **IndiChat**.

---

## 1. Authentication & Identity Management

### A. Password Hashing
- User passwords are encrypted using the **BCrypt cryptographic hash function** with a logarithmic work factor of 12.
- Plaintext passwords are never logged, serialized into DTOs, or persisted to disk.

### B. Access & Refresh Tokens
- **Access Tokens**: Short-lived JSON Web Tokens (JWT) signed with HMAC-SHA256 (`JWT_SECRET`). They encapsulate user identity and claims (`sub`, `roles`, `iat`, `exp`).
- **Refresh Tokens**: Cryptographically random strings hashed via SHA-256 before storage in the `refresh_tokens` PostgreSQL table. This prevents token theft in the event of database exfiltration.
- **Token Rotation**: Refresh tokens are single-use or time-bound; revoking a refresh token immediately invalidates session rejuvenation.

### C. Passkeys (WebAuthn / FIDO2)
- IndiChat supports Passkeys for cryptographic, biometric authentication.
- Private keys reside in secure hardware enclaves on user devices, eliminating credential phishing risks.
- Passkey credentials are registered via `POST /api/v1/users/me/passkeys` and validated against public keys stored in `user_passkey_credentials`.

### D. Two-Factor Authentication (2FA PIN)
- Users can enable Two-Factor Authentication in **Settings -> Two-Step Verification**.
- When enabled, `POST /auth/login` issues a challenge response (`requiresTwoFactor: true`) until the verified PIN is supplied.

---

## 2. Multi-Device Sessions & Remote Revocation

IndiChat implements proactive session monitoring and remote disconnection:

1. **Device Identification**:
   - Every login or link request captures `deviceId`, `deviceName`, `platform`, `browser`, and remote `ipAddress`.
   - Records are persisted in `user_linked_devices`.
2. **WebSocket Session Binding**:
   - Active WebSocket connections map the socket session ID to both the `userId` and `deviceId`.
3. **Instant Remote Disconnection**:
   - When a user terminates an active device from settings (`DELETE /api/v1/devices/{deviceId}` or `/api/v1/devices/others`):
   - The device record is deleted from PostgreSQL.
   - The WebSocket handler locates the target device socket, sends `{ "type": "DEVICE_REMOVED", "payload": { "reason": "..." } }`, and forcefully closes the socket connection with code `4001`.
   - Unauthorized subsequent reconnect attempts are rejected at the handshake level.

---

## 3. Resource Ownership & Access Authorization

IndiChat enforces strict data isolation:
- **Conversation Authorization**: Every REST endpoint (e.g. `GET /conversations/{id}/messages`) and WebSocket message dispatch validates that the authenticated `userId` belongs to `conversation_members` for that conversation.
- **Knowledge of UUID is Insufficient**: Even if a malicious actor guesses or discovers a conversation UUID, queries are rejected with `403 Forbidden` unless legitimate membership exists.
- **WebSocket Handshake Validation**: Handshakes validate the JWT token signature and expiration before upgrading the connection to WebSocket.
- **Call Journal Ownership Enforcement**: Call logs strictly validate ownership (`user_id = caller_id` for outgoing, `user_id = receiver_id` for incoming/missed). Users cannot forge call logs on behalf of arbitrary peers.

---

## 4. Network Security & Android Cleartext Policies

### Local Development vs Production:
- **Development**:
  - The Android app requires `android:usesCleartextTraffic="true"` in `apps/mobile/android/app/src/main/AndroidManifest.xml` to allow communication with local development servers over HTTP (e.g. `http://192.168.0.70:8080` or emulator `http://10.0.2.2:8080`).
- **Production**:
  - All external traffic is routed over strict HTTPS and WSS (TLS 1.3).
  - Cleartext traffic is disabled in production release configurations.

### CORS Security:
- Backend CORS configuration in `backend/src/main/resources/application.yml` restricts origins to approved web clients and development ports (`http://localhost:5173`, `http://localhost:5174`, `http://localhost:3000`, `http://localhost:8081`).

---

## 5. Media & Storage Security

- **MinIO Object Isolation**: Media files are saved with randomized UUID filenames (`912ec803-b2ce-4f81-a836-9b88265a0b41`), preventing predictable resource enumeration.
- **MIME Type Validation**: Files uploaded via `POST /api/v1/files/upload` are validated against approved MIME types and size limits (100MB maximum request size).
- **Executable Protection**: Files categorized as executables or non-standard binaries are forced to `Content-Disposition: attachment` to protect clients from automatic browser execution.

---

## 6. Token Lifecycle, Auth Recovery & WebSocket Governance

- **Token Refresh & Expiration**: When an access token expires, clients refresh credentials seamlessly via `POST /api/v1/auth/refresh` using the stored refresh token before retrying network requests.
- **WebSocket Handshake & Auth Termination (Code 1008)**: If the WebSocket receives close code `1008` (Policy Violation / Expired Handshake Credentials), the socket client initiates an automatic token refresh. If the refresh token is expired, revoked, or invalid, the session immediately terminates, stored credentials are cleared, and the application redirects to the login screen with an expiration alert.
- **Bounded Reconnect Attempts**: Reconnection loops are strictly bounded by `MAX_RECONNECT_ATTEMPTS = 5` with exponential backoff and jitter, preventing denial-of-service loops against backend servers.
- **Intentional Logout Protection**: When a user explicitly logs out, an internal intentional disconnect guard (`isIntentionalDisconnect = true`) is activated. This completely inhibits token refreshes and background socket resurrect attempts.

---

## 7. Local Archive & Backup Security

- **Read-Only Model**: Local archive imports (`LocalArchiveViewerModal.tsx`) are strictly read-only and local to the device. No server restore endpoint exists.
- **Untrusted Plaintext Model**: Archives are treated as unauthenticated, editable text.
- **Data Boundary Containment**:
  - Imported archives are never merged into live database conversations.
  - Remote attachments referenced inside archives are never fetched automatically.
  - Files are subject to strict limits: 10 MB file size, 1,000 conversations, 50,000 messages, and 10,000 characters per message. Excess data is rejected with human-readable error messages.

---

## 8. Desktop Runtime Security & Sandboxing (Electron)

The Desktop application (`apps/desktop`) implements a multi-layered security architecture:

### A. Strict Process Isolation
The main Electron browser window enforces industry-standard isolation flags:
```javascript
webPreferences: {
  sandbox: true,              // Enforces Chromium OS-level process sandboxing
  contextIsolation: true,     // Separates renderer JS context from preload scripts
  nodeIntegration: false,     // Disables Node.js APIs in the DOM
  enableRemoteModule: false   // Prohibits remote code execution
}
```

### B. Preload Context Bridge Boundary
Renderer components communicate with the operating system exclusively through `contextBridge.exposeInMainWorld()`. Only explicitly whitelisted IPC channels for window controls, notification dispatches, and system tray synchronization are exposed. Raw IPC channels or Node standard libraries are strictly inaccessible.

### C. Loopback-Only Embedded Proxy (`src/server.cjs`)
The bundled desktop proxy server binds strictly to the loopback interface:
- **Binding Host**: `127.0.0.1` (localhost only). Binding to `0.0.0.0` or external network interfaces is strictly forbidden.
- **Purpose**: Serves locally bundled React web assets and proxies `/api` and `/ws` to the backend gateway without triggering browser CORS blocks or exposing local ports to external LAN sniffers.
- **Zero-Dependency Footprint**: Uses Node.js native `http` module without vulnerable third-party web frameworks.

### D. Packaging & Code Integrity Posture
- **macOS**: Configured for Hardened Runtime (`--options runtime`) with explicit entitlement files granting only camera, microphone, and outgoing client network connections.
- **Windows**: Executable structures are validated for PE header integrity (`scripts/test-windows-resources.cjs`) and ready for Authenticode code signing.
- **Linux**: Desktop releases adhere to AppStream metadata specifications (`org.indichat.IndiChat.metainfo.xml`) and execute cleanly within AppImage and Flatpak sandbox environments.
