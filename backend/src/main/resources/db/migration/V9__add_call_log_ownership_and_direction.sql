-- ============================================================================
-- Migration: V9__add_call_log_ownership_and_direction.sql
-- Description: Add explicit personal ownership, direction, and integrity constraints
--              to call_logs table for user-scoped journal isolation.
-- ============================================================================
-- NOTE ON CLIENT-REPORTED SEMANTICS:
-- CallLog records represent personal, client-reported call journal entries recorded
-- upon call termination. They are not server-attested WebRTC signaling transcripts
-- or cryptographically verified proof that audio/video frames were exchanged.
-- ============================================================================

-- 1. Add user_id (record owner) and direction columns
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'outgoing';

-- 2. Explicit backfill of legacy records to caller ownership:
-- In the legacy model, call logs were created solely by the caller with no owner column.
-- This backfill sets user_id = caller_id and direction = 'outgoing' for all legacy rows.
-- EXPLANATION OF RECIPIENT RECORD LIMITATION:
-- This backfill binds historical ownership strictly to the known submitter (caller_id).
-- It cannot retroactively reconstruct the recipient's independent incoming or missed
-- call records, as those were never generated or submitted by the recipient's client.
-- In accordance with data integrity principles, we do NOT fabricate artificial recipient records.
UPDATE call_logs SET user_id = caller_id WHERE user_id IS NULL;
ALTER TABLE call_logs ALTER COLUMN user_id SET NOT NULL;

-- 3. Normalize legacy stored values for casing and status compatibility ('connected' -> 'completed')
UPDATE call_logs SET status = 'completed' WHERE LOWER(status) IN ('completed', 'connected');
UPDATE call_logs SET status = LOWER(status);
UPDATE call_logs SET call_type = LOWER(call_type);
UPDATE call_logs SET direction = LOWER(direction);

-- 4. Index for user-scoped call history queries
CREATE INDEX IF NOT EXISTS idx_call_logs_user_created ON call_logs(user_id, created_at DESC);

-- 5. Integrity and domain constraints:

-- 5a. Nonnegative duration
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_duration
    CHECK (duration_seconds >= 0);

-- 5b. Caller and receiver must be distinct users (disallow self-calls)
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_distinct_participants
    CHECK (caller_id <> receiver_id);

-- 5c. Record owner must be one of the call participants
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_owner_is_participant
    CHECK (user_id = caller_id OR user_id = receiver_id);

-- 5d. Permitted direction values (case-insensitive)
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_direction
    CHECK (LOWER(direction) IN ('outgoing', 'incoming', 'missed'));

-- 5e. Direction must agree with participant identity:
--     - If outgoing: record owner must be caller_id
--     - If incoming or missed: record owner must be receiver_id
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_direction_owner
    CHECK (
        (LOWER(direction) = 'outgoing' AND user_id = caller_id) OR
        (LOWER(direction) IN ('incoming', 'missed') AND user_id = receiver_id)
    );

-- 5f. Permitted call types
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_call_type
    CHECK (LOWER(call_type) IN ('voice', 'video'));

-- 5g. Permitted call statuses (including legacy 'connected' for backward compatibility)
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_status
    CHECK (LOWER(status) IN ('completed', 'connected', 'missed', 'rejected', 'busy', 'no_answer'));

-- 5h. Missed calls must have duration = 0
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_missed_duration
    CHECK (LOWER(direction) <> 'missed' OR duration_seconds = 0);

