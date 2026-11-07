#!/usr/bin/env bash
# ==============================================================================
# Script: test-disposable-migrations.sh
# Purpose: Reproducible verification of migrations through V10 on a NEW DISPOSABLE
#          PostgreSQL database (including legacy backfill, normalization & constraint validation).
#
# INVARIANTS:
# - NEVER runs against an existing/production database.
# - Spawns a temporary container on an isolated port (5599).
# - Automatically destroys the disposable container on completion or failure.
# ==============================================================================

set -euo pipefail

CONTAINER_NAME="indichat-migration-disposable-test"
TEST_PORT="5599"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="disposable_test_password"
POSTGRES_DB="indichat_disposable_test"

cleanup() {
    echo "==> Cleaning up disposable container..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "======================================================================"
echo " Starting Disposable PostgreSQL Migration Test Suite (V1 through V10)"
echo "======================================================================"

# 1. Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker CLI not found. Cannot create disposable container."
    exit 2
fi

if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running or socket is inaccessible."
    exit 2
fi

# 2. Launch isolated disposable container
echo "==> Launching disposable PostgreSQL 16 container on port ${TEST_PORT}..."
docker run --name "${CONTAINER_NAME}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -p "${TEST_PORT}:5432" \
    -d postgres:16-alpine >/dev/null

# 3. Wait for database to be ready
echo "==> Waiting for PostgreSQL to accept connections..."
for i in {1..30}; do
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
        echo "==> Database ready after ${i}s."
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo "ERROR: PostgreSQL container failed to start in time."
        exit 1
    fi
done

run_sql() {
    docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 "$@"
}

# 4. Apply migrations V1 through V7 (representing legacy state)
echo "==> Applying migrations V1 through V7..."
for v in V1 V2 V3 V4 V5 V6 V7; do
    file=$(find backend/src/main/resources/db/migration -name "${v}__*.sql" | head -n 1)
    if [ -f "$file" ]; then
        echo "    Applying ${file}..."
        run_sql < "$file" >/dev/null
    fi
done

# 5. Insert seed users
echo "==> Seeding test users (Alice, Bob, Charlie)..."
run_sql << 'EOF' >/dev/null
INSERT INTO users (id, phone_number, email, username, password_hash, display_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', '+10000000001', 'alice@test.com', 'alice', 'hash', 'Alice'),
    ('22222222-2222-2222-2222-222222222222', '+10000000002', 'bob@test.com', 'bob', 'hash', 'Bob'),
    ('33333333-3333-3333-3333-333333333333', '+10000000003', 'charlie@test.com', 'charlie', 'hash', 'Charlie');
EOF

# 6. Insert representative legacy call_logs rows (V7 structure: no user_id, no direction)
# Includes legacy connected, completed, busy, rejected, and missed records
echo "==> Inserting representative legacy call_logs records (connected, completed, busy, rejected, missed)..."
run_sql << 'EOF' >/dev/null
INSERT INTO call_logs (id, caller_id, receiver_id, conversation_id, call_type, status, duration_seconds)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NULL, 'voice', 'CONNECTED', 140),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NULL, 'video', 'completed', 300),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NULL, 'voice', 'busy', 0),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NULL, 'voice', 'rejected', 0),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NULL, 'voice', 'missed', 0);
EOF

# 7. Apply migrations V8, V9, and V10
echo "==> Applying migration V8 (Passkey Credentials)..."
run_sql < backend/src/main/resources/db/migration/V8__add_passkey_credentials.sql >/dev/null

echo "==> Applying migration V9 (Ownership & Direction Migration)..."
run_sql < backend/src/main/resources/db/migration/V9__add_call_log_ownership_and_direction.sql >/dev/null

echo "==> Applying migration V10 (Status & Direction Consistency Migration)..."
run_sql < backend/src/main/resources/db/migration/V10__enforce_call_log_status_direction_consistency.sql >/dev/null

# 8. Verify legacy backfill & normalization
echo "==> Verifying legacy record backfill & normalization results..."

# All 5 rows must have user_id = Alice (caller) and direction = 'outgoing'
BACKFILL_OWNER_COUNT=$(run_sql -t -A -c "
    SELECT count(*) FROM call_logs
    WHERE user_id = '11111111-1111-1111-1111-111111111111'
      AND direction = 'outgoing';
")
if [ "$BACKFILL_OWNER_COUNT" -eq 5 ]; then
    echo "    ✓ Legacy ownership backfill succeeded (5/5 rows bound to user_id=caller_id and direction='outgoing')."
else
    echo "    ✗ Legacy ownership backfill failed: expected 5 rows, got ${BACKFILL_OWNER_COUNT}."
    exit 1
fi

# Row 1: CONNECTED -> completed
ROW1_STATUS=$(run_sql -t -A -c "SELECT status FROM call_logs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';")
if [ "$ROW1_STATUS" = "completed" ]; then
    echo "    ✓ Legacy CONNECTED normalized to completed."
else
    echo "    ✗ Row 1 normalization failed: status is ${ROW1_STATUS}."
    exit 1
fi

# Row 5: missed -> no_answer (outgoing unanswered call normalized deterministically)
ROW5_STATUS=$(run_sql -t -A -c "SELECT status FROM call_logs WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';")
if [ "$ROW5_STATUS" = "no_answer" ]; then
    echo "    ✓ Legacy outgoing missed normalized to no_answer."
else
    echo "    ✗ Row 5 normalization failed: status is ${ROW5_STATUS}."
    exit 1
fi

# Rows 3 & 4: busy and rejected preserved
ROW3_STATUS=$(run_sql -t -A -c "SELECT status FROM call_logs WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';")
ROW4_STATUS=$(run_sql -t -A -c "SELECT status FROM call_logs WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';")
if [ "$ROW3_STATUS" = "busy" ] && [ "$ROW4_STATUS" = "rejected" ]; then
    echo "    ✓ Legacy busy and rejected statuses preserved."
else
    echo "    ✗ Busy/rejected preservation failed: row3=${ROW3_STATUS}, row4=${ROW4_STATUS}."
    exit 1
fi

# 9. Verify database constraint enforcement on invalid records
echo "==> Testing database constraint rejections on invalid records (V9 & V10 constraints)..."

expect_failure() {
    local desc="$1"
    local sql="$2"
    if run_sql -c "$sql" >/dev/null 2>&1; then
        echo "    ✗ FAIL: ${desc} was unexpectedly accepted by database!"
        exit 1
    else
        echo "    ✓ PASS: ${desc} correctly rejected by database constraint."
    fi
}

# V9 Constraints
expect_failure "Self-call (caller_id == receiver_id)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'outgoing', 'voice', 'completed', 30);"

expect_failure "Negative duration" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'completed', -5);"

expect_failure "Owner is not a participant (user_id = Charlie)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'completed', 10);"

expect_failure "Direction/Owner mismatch (outgoing with user_id = receiver_id)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'completed', 10);"

expect_failure "Direction/Owner mismatch (incoming with user_id = caller_id)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'incoming', 'voice', 'completed', 10);"

expect_failure "Invalid direction enum value ('sideways')" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'sideways', 'voice', 'completed', 10);"

expect_failure "Invalid call_type enum value ('telepathy')" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'telepathy', 'completed', 10);"

expect_failure "Invalid status enum value ('flying')" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'flying', 10);"

# V10 Specific Consistency Constraints
expect_failure "V10: Status 'missed' with duration > 0 (chk_call_logs_status_missed_duration)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'incoming', 'voice', 'missed', 45);"

expect_failure "V10: Direction 'missed' with status 'completed' (chk_call_logs_missed_direction_status)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'missed', 'voice', 'completed', 0);"

expect_failure "V10: Outgoing direction with status 'missed' (chk_call_logs_outgoing_not_missed)" \
    "INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
     VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'missed', 0);"

# 10. Verify valid insertions across all allowed combinations
echo "==> Testing valid record insertions across all allowed direction/status combinations..."

run_sql << 'EOF' >/dev/null
-- 1. Outgoing Completed (duration > 0)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'completed', 120);

-- 2. Outgoing No Answer (duration = 0)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'video', 'no_answer', 0);

-- 3. Outgoing Busy (duration = 0)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'voice', 'busy', 0);

-- 4. Outgoing Rejected (duration = 0)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'outgoing', 'video', 'rejected', 0);

-- 5. Incoming Completed (duration > 0, true identities preserved)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'incoming', 'voice', 'completed', 180);

-- 6. Incoming Rejected (duration = 0)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'incoming', 'video', 'rejected', 0);

-- 7. Missed Call (duration = 0)
INSERT INTO call_logs (user_id, caller_id, receiver_id, direction, call_type, status, duration_seconds)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'missed', 'voice', 'missed', 0);
EOF

TOTAL_COUNT=$(run_sql -t -A -c "SELECT count(*) FROM call_logs;")
echo "    ✓ Successfully stored valid records (total count in disposable db: ${TOTAL_COUNT} = 5 legacy + 7 valid new)."

echo "======================================================================"
echo " Disposable PostgreSQL Migration Test Suite PASSED COMPLETELY!        "
echo "======================================================================"
