# API Contracts & WebSocket Specifications

This document defines the complete REST API endpoints and WebSocket protocol specifications for the **IndiChat** platform.

---

## REST API (Base URL: `/api/v1`)

All endpoints (except `/auth/register`, `/auth/login`, and `/auth/refresh`) require a Bearer token in the HTTP `Authorization` header:
```http
Authorization: Bearer <accessToken>
```

Optional device tracking headers can be passed on any request:
- `X-Device-Id`: Client UUID identifying the current device/session.
- `X-Device-Name`: Human-readable device name (e.g. `Chrome on Linux`, `Pixel 8 Pro`).
- `X-Device-Platform`: Platform type (`web`, `android`, `ios`).
- `X-Device-Browser`: Browser or user-agent fingerprint.

---

### 1. Authentication (`/api/v1/auth`)

#### `POST /auth/register`
Register a new user account.
- **Request Body**:
  ```json
  {
    "phoneNumber": "+1234567890",
    "username": "alice",
    "email": "alice@example.com",
    "password": "StrongPassword123!",
    "displayName": "Alice Smith"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "tokenType": "Bearer",
      "expiresIn": 86400000
    },
    "user": {
      "id": "e9c1c4f2-95f2-4914-8742-d3369a45bb38",
      "username": "alice",
      "displayName": "Alice Smith",
      "status": "ACTIVE",
      "createdAt": "2026-10-23T10:00:00Z"
    }
  }
  ```

#### `POST /auth/login`
Authenticate existing user with credentials, optional 2FA PIN, and device metadata.
- **Request Body**:
  ```json
  {
    "usernameOrEmail": "alice",
    "password": "StrongPassword123!",
    "twoFactorPin": "123456",
    "deviceId": "b4764b4c-9f69-42ce-92eb-0c7fbaefbc94",
    "deviceName": "Chrome on Linux",
    "platform": "web",
    "browser": "Chrome 130"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "tokenType": "Bearer",
      "expiresIn": 86400000
    },
    "user": {
      "id": "e9c1c4f2-95f2-4914-8742-d3369a45bb38",
      "username": "alice",
      "displayName": "Alice Smith"
    }
  }
  ```
- **Response `200 OK (2FA Challenge Required)`**:
  ```json
  {
    "requiresTwoFactor": true,
    "message": "Two-factor authentication required"
  }
  ```

#### `POST /auth/refresh`
Rotate access token using a valid refresh token.
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": 86400000
  }
  ```

#### `POST /auth/logout`
Revoke active session and disconnect device socket.
- **Headers**: `X-Device-Id: <UUID>`
- **Response `200 OK`**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

#### Demo Accounts & Pre-Seeded Profiles
For local development and testing, run `npm run db:seed` to populate the following accounts:

| User | Username | Email | Phone Number | Password | 2FA Status | Role / Bio |
|---|---|---|---|---|---|---|
| **Alice Cooper** | `alice` | `alice@example.com` | `+12345678901` | `Password123!` | 🔒 **PIN: `112233`** | Community Admin / Building IndiChat 🚀 |
| **Bob Dylan** | `bob` | `bob@example.com` | `+12345678902` | `Password123!` | None | Member / Hey there! I am using IndiChat. |
| **Charlie Davis** | `charlie` | `charlie@example.com` | `+12345678903` | `Password123!` | None | Member / Coffee, code, repeat ☕💻 |
| **David Miller** | `david` | `david@example.com` | `+12345678904` | `Password123!` | None | Member / Available for quick calls 📞 |
| **Emma Watson** | `emma` | `emma@example.com` | `+12345678905` | `Password123!` | None | Member / Designing sleek user interfaces ✨ |
| **Frank Castle** | `frank` | `frank@example.com` | `+12345678906` | `Password123!` | None | Member / Away on a business trip ✈️ |
| **Grace Hopper** | `grace` | `grace@example.com` | `+12345678907` | `Password123!` | None | Member / First bug found here! 🐞 |

- Mutual contacts are automatically synchronized across all 7 demo accounts (6 contacts each).
- Pre-seeded group conversation: `"IndiChat Community"` (all 7 members enrolled with initial message history).

---

### 2. User & Discovery (`/api/v1/users`)

#### `GET /users/me`
Retrieve authenticated user profile and status.
- **Response `200 OK`**:
  ```json
  {
    "id": "e9c1c4f2-95f2-4914-8742-d3369a45bb38",
    "username": "alice",
    "displayName": "Alice Smith",
    "email": "alice@example.com",
    "avatarKey": "avatars/alice.png",
    "status": "ACTIVE",
    "lastSeenAt": "2026-10-23T12:00:00Z"
  }
  ```

#### `GET /users/search?q={query}`
Search contacts by username, display name, or phone number.
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "761611c0-03fe-4ae1-8d26-7f8158d34fb2",
      "username": "bob",
      "displayName": "Bob Builder",
      "avatarKey": null
    }
  ]
  ```

---

### 3. Contacts (`/api/v1/contacts`)

#### `GET /contacts`
List all saved contacts for the authenticated user.

#### `POST /contacts`
Add a user to personal contacts with optional nickname.
- **Request Body**:
  ```json
  {
    "contactUserId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2",
    "nickname": "Bobby"
  }
  ```

---

### 4. Conversations (`/api/v1/conversations`)

#### `GET /conversations`
List user's active conversations sorted by latest activity, including unread count and latest message preview.

#### `POST /conversations`
Create direct or group conversation.
- **Request Body**:
  ```json
  {
    "type": "DIRECT",
    "participantIds": ["761611c0-03fe-4ae1-8d26-7f8158d34fb2"],
    "title": null
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": "f5127d14-06c8-47bc-a988-158a2dbe1267",
    "type": "DIRECT",
    "createdAt": "2026-10-23T12:01:00Z",
    "members": [
      { "userId": "e9c1c4f2-95f2-4914-8742-d3369a45bb38", "role": "ADMIN" },
      { "userId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2", "role": "MEMBER" }
    ]
  }
  ```

#### `GET /conversations/{id}/messages?cursor={created_at}&limit=50`
Retrieve paginated message history.
- **Response `200 OK`**:
  ```json
  {
    "messages": [
      {
        "id": "c3397984-3c81-42db-a0f5-568ea46a9a3b",
        "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267",
        "senderId": "e9c1c4f2-95f2-4914-8742-d3369a45bb38",
        "clientMessageId": "a1103c80-86b2-4d56-8575-cf00f2824cf4",
        "type": "TEXT",
        "content": "Hello Bob!",
        "createdAt": "2026-10-23T12:05:00Z",
        "receipts": [
          { "userId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2", "deliveredAt": "2026-10-23T12:05:01Z", "readAt": null }
        ]
      }
    ],
    "hasMore": false,
    "nextCursor": null
  }
  ```

---

### 5. Media & Object Storage (`/api/v1/files`)

#### `POST /files/upload`
Upload an image, video, audio voice note, sticker, or document. Supports multipart/form-data.
- **Form Param**: `file` (MultipartFile)
- **Response `201 Created`**:
  ```json
  {
    "fileId": "912ec803-b2ce-4f81-a836-9b88265a0b41",
    "fileName": "photo.jpg",
    "fileType": "IMAGE",
    "mimeType": "image/jpeg",
    "fileSize": 348201,
    "fileUrl": "/api/v1/files/download/912ec803-b2ce-4f81-a836-9b88265a0b41/photo.jpg"
  }
  ```

#### `GET /files/{fileId}` or `GET /files/download/{fileId}/{fileName}`
Download or stream file binary. If query param `?download=true` is provided, enforces `Content-Disposition: attachment`.

---

### 6. User Settings & Privacy (`/api/v1/settings`)

#### `GET /settings`
Retrieve current user settings.
- **Response `200 OK`**:
  ```json
  {
    "passkeyEnabled": false,
    "twoFactorEnabled": true,
    "securityNotifications": true,
    "statusAbout": "Available",
    "privacyLastSeen": "everyone",
    "privacyOnline": "everyone",
    "privacyProfilePhoto": "everyone",
    "privacyStatus": "contacts",
    "readReceipts": true,
    "enterIsSend": true,
    "mediaVisibility": true,
    "fontSize": "medium",
    "language": "en",
    "lastBackupAt": "2026-10-23T08:00:00Z"
  }
  ```

#### `PUT /settings`
Update user settings, 2FA credentials, or privacy rules.

---

### 7. Linked Devices (`/api/v1/devices`)

#### `GET /devices`
List all devices currently linked to the account.
- **Headers**: `X-Device-Id`
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "b4764b4c-9f69-42ce-92eb-0c7fbaefbc94",
      "deviceName": "Chrome on Linux",
      "platform": "web",
      "browser": "Chrome 130",
      "location": "Pune, India",
      "ipAddress": "192.168.0.70",
      "lastActiveAt": "2026-10-23T15:30:00Z",
      "isCurrent": true
    }
  ]
  ```

#### `POST /devices/link`
Register new device fingerprint.

#### `DELETE /devices/{deviceId}`
Revoke specific linked device and instantly disconnect its socket.

#### `DELETE /devices/others`
Revoke all other active device sessions across the entire account.

---

### 8. Push Notification Tokens (`/api/v1/devices/token`)

#### `POST /devices/token`
Register Expo push token for mobile notifications.
- **Request Body**:
  ```json
  {
    "token": "ExponentPushToken[xxxxxxxxxxxxxx]",
    "platform": "ANDROID"
  }
  ```

#### `DELETE /devices/token`
Unregister device push token upon logout.

---

## WebSocket Protocol (`/ws?token={jwt}&deviceId={uuid}`)

Clients establish a full-duplex socket with JWT authentication either through query parameter `?token=...` or standard authorization headers.

### Client to Server Messages

#### 1. Send Message (`message.send`)
```json
{
  "type": "message.send",
  "requestId": "req-001",
  "payload": {
    "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267",
    "clientMessageId": "a1103c80-86b2-4d56-8575-cf00f2824cf4",
    "messageType": "TEXT",
    "content": "Hello world!",
    "replyToId": null
  }
}
```
*Supported `messageType` values*: `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `STICKER`, `CALL`.

#### 2. Delivery Receipt (`message.delivered`)
Sent by recipient when message frame is received on active socket.
```json
{
  "type": "message.delivered",
  "payload": {
    "messageId": "c3397984-3c81-42db-a0f5-568ea46a9a3b",
    "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267"
  }
}
```

#### 3. Read Receipt (`message.read`)
Sent by recipient when opening conversation.
```json
{
  "type": "message.read",
  "payload": {
    "messageId": "c3397984-3c81-42db-a0f5-568ea46a9a3b",
    "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267"
  }
}
```

#### 4. Typing State (`typing.start` / `typing.stop`)
```json
{
  "type": "typing.start",
  "payload": { "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267" }
}
```

#### 5. Presence Subscription (`presence.subscribe`)
```json
{
  "type": "presence.subscribe",
  "payload": {
    "userIds": ["761611c0-03fe-4ae1-8d26-7f8158d34fb2"]
  }
}
```

#### 6. WebRTC Call Signal (`call.signal`)
```json
{
  "type": "call.signal",
  "payload": {
    "targetUserId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2",
    "signalType": "offer",
    "data": {
      "sdp": "...",
      "isVideo": false
    }
  }
}
```
*Supported `signalType` values*: `offer`, `answer`, `ice-candidate`, `hangup`.

---

### Server to Client Messages

#### 1. Message Created (`message.created`)
Broadcast to all conversation members upon message persistence.
```json
{
  "type": "message.created",
  "requestId": "req-001",
  "payload": {
    "id": "c3397984-3c81-42db-a0f5-568ea46a9a3b",
    "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267",
    "senderId": "e9c1c4f2-95f2-4914-8742-d3369a45bb38",
    "clientMessageId": "a1103c80-86b2-4d56-8575-cf00f2824cf4",
    "type": "TEXT",
    "content": "Hello world!",
    "createdAt": "2026-10-23T12:05:00Z",
    "receipts": []
  }
}
```

#### 2. Receipt Updated (`message.receipt.updated`)
Broadcast when recipient delivers or reads a message.
```json
{
  "type": "message.receipt.updated",
  "payload": {
    "messageId": "c3397984-3c81-42db-a0f5-568ea46a9a3b",
    "userId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2",
    "deliveredAt": "2026-10-23T12:05:01Z",
    "readAt": "2026-10-23T12:06:15Z"
  }
}
```

#### 3. Typing Notification (`typing.updated`)
```json
{
  "type": "typing.updated",
  "payload": {
    "conversationId": "f5127d14-06c8-47bc-a988-158a2dbe1267",
    "userId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2",
    "isTyping": true
  }
}
```

#### 4. Presence Notification (`presence.updated` / `presence.batch`)
```json
{
  "type": "presence.updated",
  "payload": {
    "userId": "761611c0-03fe-4ae1-8d26-7f8158d34fb2",
    "isOnline": true,
    "lastSeenAt": "2026-10-23T15:30:00Z"
  }
}
```

#### 5. Session Revoked (`DEVICE_REMOVED`)
Emitted to target device before socket termination (status code 4001).
```json
{
  "type": "DEVICE_REMOVED",
  "payload": {
    "deviceId": "b4764b4c-9f69-42ce-92eb-0c7fbaefbc94",
    "reason": "This device session has been logged out."
  }
}
```
