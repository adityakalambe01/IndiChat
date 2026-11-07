# Database Schema & Data Models

This document details the PostgreSQL relational database schema managed via **Flyway migrations** (`backend/src/main/resources/db/migration/`).

---

## 1. Schema Design Principles
- **Identifier Strategy**: All primary keys are UUIDs generated using `gen_random_uuid()`.
- **Temporal Integrity**: All date/time fields use `TIMESTAMPTZ` (UTC timestamp with time zone).
- **Referential Integrity**: Cascading deletes (`ON DELETE CASCADE`) are applied to child rows where lifecycle is tied to the parent entity (e.g. conversation members, receipts, settings, linked devices).
- **Performance Indexing**: Keyset pagination indexes, composite lookup indexes, and unique constraints are defined explicitly.

---

## 2. Table Specifications

### 1. `users` (Migration: `V1`)
Primary user credentials and profile records.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique user identifier |
| `phone_number` | VARCHAR(20) | UNIQUE, NULLABLE | Optional phone number for mobile login |
| `email` | VARCHAR(255) | UNIQUE, NULLABLE | Email address |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Unique handle |
| `password_hash`| TEXT | NULLABLE | BCrypt password hash (work factor 12) |
| `display_name` | VARCHAR(100) | NOT NULL | Human-readable user name |
| `avatar_key` | TEXT | NULLABLE | MinIO S3 object key for user avatar |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Registration timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Profile last modified |
| `last_seen_at` | TIMESTAMPTZ | NULLABLE | Last recorded online activity |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT `'ACTIVE'` | Account state (`ACTIVE`, `INACTIVE`, `SUSPENDED`) |

---

### 2. `conversations` (Migration: `V1`)
Direct and group chat rooms.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Conversation identifier |
| `type` | VARCHAR(10) | NOT NULL, CHECK in (`DIRECT`, `GROUP`) | Direct 1:1 or multi-party chat |
| `title` | VARCHAR(150) | NULLABLE | Optional group conversation title |
| `created_by` | UUID | REFERENCES `users(id)` | Creator user ID |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Latest activity timestamp |

---

### 3. `conversation_members` (Migration: `V1`)
Membership mapping and user conversation state.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `conversation_id` | UUID | NOT NULL, REFERENCES `conversations(id)` ON DELETE CASCADE | Target conversation |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Participant user ID |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT `'MEMBER'` | Role (`ADMIN`, `MEMBER`) |
| `joined_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Join timestamp |
| `last_read_message_id` | UUID | NULLABLE | Pointer to last read message |
| `muted_until` | TIMESTAMPTZ | NULLABLE | Notification mute expiry |

**Primary Key**: `(conversation_id, user_id)`

---

### 4. `messages` (Migration: `V1`)
Individual chat messages, multimedia, voice notes, stickers, and calls.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Canonical server message UUID |
| `conversation_id` | UUID | NOT NULL, REFERENCES `conversations(id)` ON DELETE CASCADE | Target conversation |
| `sender_id` | UUID | NOT NULL, REFERENCES `users(id)` | Sender user ID |
| `client_message_id` | UUID | NOT NULL | Client-side idempotency UUID |
| `type` | VARCHAR(20) | NOT NULL, DEFAULT `'TEXT'` | `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `STICKER`, `CALL` |
| `content` | TEXT | NULLABLE | Text message body or media metadata JSON |
| `reply_to_id` | UUID | NULLABLE, REFERENCES `messages(id)` | Quoted reply message ID |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Server persistence timestamp |
| `edited_at` | TIMESTAMPTZ | NULLABLE | Timestamp if message edited |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete timestamp |

**Unique Constraint**: `UNIQUE (sender_id, client_message_id)` (prevents duplicate submissions)

---

### 5. `message_receipts` (Migration: `V1`)
Per-user delivery and read acknowledgement tracking.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `message_id` | UUID | NOT NULL, REFERENCES `messages(id)` ON DELETE CASCADE | Target message |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Recipient user ID |
| `delivered_at` | TIMESTAMPTZ | NULLABLE | Timestamp socket delivered (Double Check ✓✓) |
| `read_at` | TIMESTAMPTZ | NULLABLE | Timestamp conversation read (Double Blue Check ✓✓) |

**Primary Key**: `(message_id, user_id)`

---

### 6. `refresh_tokens` (Migrations: `V1`, `V4`)
Cryptographically secured session refresh tokens.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Refresh token record ID |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Target user ID |
| `token_hash` | VARCHAR(512)| NOT NULL, UNIQUE | SHA-256 hash of refresh token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Token expiration date |
| `revoked` | BOOLEAN | NOT NULL, DEFAULT `FALSE` | Manual revocation flag |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Generation timestamp |

---

### 7. `device_tokens` (Migration: `V2`)
Mobile and web push notification device registry.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Token record ID |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Target user |
| `token` | VARCHAR(512)| NOT NULL | Push notification token (e.g. Expo token) |
| `platform` | VARCHAR(32) | NOT NULL, DEFAULT `'WEB'` | `ANDROID`, `IOS`, `WEB` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Registration timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Last updated timestamp |

**Unique Constraint**: `UNIQUE (user_id, token)`

---

### 8. `user_linked_devices` (Migration: `V3`)
Active devices and sessions for multi-device management.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Device session UUID |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Owner user ID |
| `device_name` | VARCHAR(150)| NOT NULL | Name (e.g. Chrome on Linux, Pixel 8) |
| `platform` | VARCHAR(50) | NOT NULL, DEFAULT `'web'` | Platform (`web`, `android`, `ios`) |
| `browser` | VARCHAR(150)| NULLABLE | Browser or client user-agent |
| `location` | VARCHAR(150)| NULLABLE | Geo-location or network location |
| `ip_address` | VARCHAR(64) | NULLABLE | Remote IP address |
| `last_active_at`| TIMESTAMPTZ| NOT NULL, DEFAULT `now()` | Heartbeat timestamp |
| `is_current` | BOOLEAN | NOT NULL, DEFAULT `false` | Current session flag |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Initial pairing timestamp |

---

### 9. `user_settings` (Migration: `V3`)
User configuration, privacy policies, 2FA, and passkey flags.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | UUID | PRIMARY KEY, REFERENCES `users(id)` ON DELETE CASCADE | Owner user ID |
| `passkey_enabled` | BOOLEAN | NOT NULL, DEFAULT `false` | Passkey (WebAuthn) enabled |
| `two_factor_enabled` | BOOLEAN | NOT NULL, DEFAULT `false` | Two-Factor PIN authentication enabled |
| `two_factor_pin` | VARCHAR(20) | NULLABLE | Hashed 2FA PIN |
| `security_notifications`| BOOLEAN | NOT NULL, DEFAULT `true` | Security alert emails/notifications |
| `status_about` | TEXT | DEFAULT `'Hey there! I am using IndiChat.'` | Profile bio status |
| `privacy_last_seen` | VARCHAR(30) | NOT NULL, DEFAULT `'everyone'` | `'everyone'`, `'contacts'`, `'nobody'` |
| `privacy_online` | VARCHAR(30) | NOT NULL, DEFAULT `'everyone'` | Online status visibility |
| `privacy_profile_photo` | VARCHAR(30) | NOT NULL, DEFAULT `'everyone'` | Avatar visibility |
| `privacy_links` | VARCHAR(30) | NOT NULL, DEFAULT `'everyone'` | Link preview settings |
| `privacy_status` | VARCHAR(30) | NOT NULL, DEFAULT `'contacts'` | Status stories visibility |
| `privacy_excluded_contacts`| TEXT | DEFAULT `''` | Comma-separated excluded contact IDs |
| `read_receipts` | BOOLEAN | NOT NULL, DEFAULT `true` | Enable/disable blue read ticks |
| `enter_is_send` | BOOLEAN | NOT NULL, DEFAULT `true` | Enter key transmits message |
| `media_visibility` | BOOLEAN | NOT NULL, DEFAULT `true` | Auto-save media to device |
| `font_size` | VARCHAR(20) | NOT NULL, DEFAULT `'medium'` | `'small'`, `'medium'`, `'large'` |
| `language` | VARCHAR(10) | NOT NULL, DEFAULT `'en'` | Active language code |
| `last_backup_at` | TIMESTAMPTZ | NULLABLE | Timestamp of last chat backup |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Last settings update |

---

### 10. `message_reactions` (Migration: `V5`)
Emoji reactions pinned to individual messages.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Reaction identifier |
| `message_id` | UUID | NOT NULL, REFERENCES `messages(id)` ON DELETE CASCADE | Target message |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | User who reacted |
| `emoji` | VARCHAR(16) | NOT NULL | Emoji character/glyph |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Timestamp |

**Unique Constraint**: `(message_id, user_id, emoji)`

---

### 11. `user_starred_messages` (Migration: `V5`)
User-specific bookmarked/starred messages.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Star identifier |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | User who starred |
| `message_id` | UUID | NOT NULL, REFERENCES `messages(id)` ON DELETE CASCADE | Target message |
| `starred_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Timestamp |

**Unique Constraint**: `(user_id, message_id)`

---

### 12. `communities` & `community_channels` (Migration: `V6`)
Hierarchical communities containing announcement channels and discussion sub-groups.
| Table | Key Columns | Description |
|---|---|---|
| `communities` | `id`, `name`, `description`, `icon_url`, `created_by` | Community root workspace |
| `community_channels` | `id`, `community_id`, `name`, `type` (`ANNOUNCEMENT`/`GENERAL`), `conversation_id` | Sub-channels |
| `community_members` | `community_id`, `user_id`, `role` (`ADMIN`/`MEMBER`) | Membership mapping |

---

### 13. `call_logs` & `user_status_stories` (Migrations: `V7`, `V9`, `V10`)

Personal call history journal entries and 24-hour expiring status stories.

> **Client-Reported Semantics Notice**: `call_logs` entries represent personal, client-reported call journal entries recorded upon call termination. They are not server-verified WebRTC signaling transcripts or cryptographic proof.

#### `call_logs` Schema (Updated in `V9` & `V10`)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Record ID |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Record owner (journal owner) |
| `caller_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | True call initiator |
| `receiver_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | True call recipient |
| `conversation_id` | UUID | REFERENCES `conversations(id)` ON DELETE SET NULL | Associated chat thread (optional) |
| `direction` | VARCHAR(20) | NOT NULL, DEFAULT `'outgoing'` | Call direction (`outgoing`, `incoming`, `missed`) |
| `call_type` | VARCHAR(20) | NOT NULL, DEFAULT `'voice'` | Media type (`voice`, `video`) |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT `'completed'` | Status (`completed`, `connected`, `missed`, `rejected`, `busy`, `no_answer`) |
| `duration_seconds` | INT | NOT NULL, DEFAULT `0` | Call duration in seconds (0 for missed/unanswered) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Timestamp |

#### Database Constraints (Migrations `V9` & `V10`)
1. `chk_call_logs_duration`: `duration_seconds >= 0` (`V9`)
2. `chk_call_logs_distinct_participants`: `caller_id <> receiver_id` (no self-calls, `V9`)
3. `chk_call_logs_owner_is_participant`: `user_id = caller_id OR user_id = receiver_id` (`V9`)
4. `chk_call_logs_direction`: `LOWER(direction) IN ('outgoing', 'incoming', 'missed')` (`V9`)
5. `chk_call_logs_direction_owner`: `(LOWER(direction) = 'outgoing' AND user_id = caller_id) OR (LOWER(direction) IN ('incoming', 'missed') AND user_id = receiver_id)` (`V9`)
6. `chk_call_logs_call_type`: `LOWER(call_type) IN ('voice', 'video')` (`V9`)
7. `chk_call_logs_status`: `LOWER(status) IN ('completed', 'connected', 'missed', 'rejected', 'busy', 'no_answer')` (`V9`)
8. `chk_call_logs_missed_duration`: `LOWER(direction) <> 'missed' OR duration_seconds = 0` (`V9`)
9. `chk_call_logs_status_missed_duration`: `LOWER(status) <> 'missed' OR duration_seconds = 0` (`V10`)
10. `chk_call_logs_missed_direction_status`: `LOWER(direction) <> 'missed' OR LOWER(status) = 'missed'` (`V10`)
11. `chk_call_logs_outgoing_not_missed`: `LOWER(direction) <> 'outgoing' OR LOWER(status) <> 'missed'` (`V10`)

#### Legacy Migration Backfill & Normalization (`V9`, `V10`)
* **V9 Ownership Backfill**: Existing rows created under `V7` lacked `user_id` and `direction`. Migration `V9` explicitly sets `user_id = caller_id` and `direction = 'outgoing'`.
* **Recipient Record Limitation**: Historical ownership is bound strictly to the known submitter (`caller_id`). It cannot retroactively reconstruct the recipient's independent incoming or missed call records, as those were never generated or submitted by the recipient's client. IndiChat does not fabricate artificial recipient records.
* **V10 Status Normalization**: In V7, callers recorded unanswered outgoing calls as `status: 'missed'`. In the personal journal model, the caller's perspective of an unanswered call is `'no_answer'` (whereas `'missed'` is the recipient's perspective). `V10` deterministically normalizes legacy `(direction = 'outgoing', status = 'missed', duration = 0)` to `status = 'no_answer'`, preserving historical meaning without data loss. If any record has `status = 'missed'` with `duration > 0`, `V10` aborts with an actionable diagnostic.

#### `user_status_stories` Table
| Table | Key Columns | Description |
|---|---|---|
| `user_status_stories` | `id`, `user_id`, `media_type`, `caption`, `media_url`, `created_at`, `expires_at` (24h default) | Ephemeral status |

---

### 14. `user_passkey_credentials` (Migration: `V8`)
FIDO2 / WebAuthn passkey credentials for biometrics / security keys.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Passkey record ID |
| `user_id` | UUID | NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE | Credential owner |
| `credential_id` | VARCHAR(255) | UNIQUE, NOT NULL | WebAuthn raw credential ID |
| `public_key` | TEXT | NOT NULL | Base64-encoded public key |
| `device_name` | VARCHAR(100) | NOT NULL, DEFAULT `'Passkey'` | Human-friendly device name |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Registration timestamp |

---

## 3. Database Indexes

To maintain sub-millisecond query performance across large chat volumes:
- `idx_messages_history`: `(conversation_id, created_at DESC, id DESC)` — Guarantees instant keyset pagination for conversations with millions of messages.
- `idx_members_by_user`: `(user_id, conversation_id)` — Quick retrieval of user conversation lists.
- `idx_receipts_by_user`: `(user_id, message_id)` — Rapid lookup of delivered/read receipts for incoming batches.
- `idx_device_tokens_user_id`: `(user_id)` — Fast push notification subscriber lookup.
- `idx_linked_devices_user_id`: `(user_id)` — Fast session management and remote revocation queries.
- `idx_msg_reactions_lookup`: `(message_id)` — Fast reaction aggregation per message.
- `idx_starred_user`: `(user_id, starred_at DESC)` — Rapid listing of bookmarked messages.
- `idx_status_active`: `(user_id, expires_at)` — Efficient 24h active status queries.
- `idx_calls_user`: `(user_id, started_at DESC)` — Chronological call history retrieval.
