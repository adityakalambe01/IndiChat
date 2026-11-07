-- ============================================================================
-- Migration: V10__enforce_call_log_status_direction_consistency.sql
-- Description: Enforces database/service consistency for call status, direction,
--              and duration combinations.
-- ============================================================================
-- NOTE ON DATA COMPATIBILITY & HISTORICAL MEANING:
-- 1. Under V7, all call logs were client-submitted by the caller (caller_id).
-- 2. Under V9, legacy call logs were backfilled with user_id = caller_id and
--    direction = 'outgoing'.
-- 3. In the personal journal model, an unanswered call from the caller's perspective
--    is 'no_answer'. The recipient's perspective is 'missed'.
-- 4. For legacy records where status was recorded as 'missed' with duration = 0,
--    deterministic normalization maps status to 'no_answer' to preserve caller ownership
--    and the historical event (an unanswered outgoing call) without data loss.
-- 5. If any record has status = 'missed' with duration > 0, deterministic normalization
--    is NOT justified. The migration halts with an actionable diagnostic.
-- ============================================================================

-- 1. Actionable Diagnostic Pre-Check:
-- Detect corrupted records where status is 'missed' but duration > 0.
DO $$
DECLARE
    invalid_duration_count INT;
BEGIN
    SELECT count(*) INTO invalid_duration_count
    FROM call_logs
    WHERE LOWER(status) = 'missed' AND duration_seconds > 0;

    IF invalid_duration_count > 0 THEN
        RAISE EXCEPTION 'Migration V10 aborted: Found % records with status=''missed'' and duration_seconds > 0. A missed call cannot have duration. Actionable diagnostic: inspect and apply approved repair policy before applying V10.', invalid_duration_count;
    END IF;
END $$;

-- 2. Deterministic Normalization of Legacy Outgoing Missed Calls:
-- Converts caller-owned legacy unanswered calls (direction='outgoing', status='missed', duration=0)
-- to status='no_answer', aligning with CallLogService and the caller's journal perspective.
UPDATE call_logs
SET status = 'no_answer'
WHERE LOWER(direction) = 'outgoing'
  AND LOWER(status) = 'missed'
  AND duration_seconds = 0;

-- 3. Fail-Safe Diagnostic Check:
-- Ensure no incompatible records remain before adding constraints.
DO $$
DECLARE
    incompatible_count INT;
BEGIN
    SELECT count(*) INTO incompatible_count
    FROM call_logs
    WHERE LOWER(direction) = 'outgoing' AND LOWER(status) = 'missed';

    IF incompatible_count > 0 THEN
        RAISE EXCEPTION 'Migration V10 aborted: Found % incompatible records with direction=''outgoing'' and status=''missed''. Adding constraint chk_call_logs_outgoing_not_missed would fail.', incompatible_count;
    END IF;
END $$;

-- 4. Add Consistency Constraints:

-- 4a. Status 'missed' must have duration = 0
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_status_missed_duration
    CHECK (LOWER(status) <> 'missed' OR duration_seconds = 0);

-- 4b. Direction 'missed' must have status 'missed'
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_missed_direction_status
    CHECK (LOWER(direction) <> 'missed' OR LOWER(status) = 'missed');

-- 4c. Outgoing direction cannot have status 'missed' (callers record no_answer, rejected, or busy)
ALTER TABLE call_logs ADD CONSTRAINT chk_call_logs_outgoing_not_missed
    CHECK (LOWER(direction) <> 'outgoing' OR LOWER(status) <> 'missed');

