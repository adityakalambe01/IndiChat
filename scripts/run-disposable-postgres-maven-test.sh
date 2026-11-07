#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="indichat-disposable-mvn-pg"
TEST_PORT="5597"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="disposable_pass_123"
POSTGRES_DB="disposable_mvn_pg_test"

DOCKER_BIN="${DOCKER_BIN:-docker}"
if ! command -v "$DOCKER_BIN" >/dev/null 2>&1 && [ -x "$HOME/.docker/bin/docker" ]; then
    DOCKER_BIN="$HOME/.docker/bin/docker"
fi

cleanup() {
    echo "==> Cleaning up disposable PostgreSQL container (${CONTAINER_NAME})..."
    "$DOCKER_BIN" rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting isolated disposable PostgreSQL 16 on port ${TEST_PORT}..."
"$DOCKER_BIN" run --name "${CONTAINER_NAME}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -p "${TEST_PORT}:5432" \
    -d postgres:16-alpine >/dev/null

echo "==> Waiting for disposable PostgreSQL to accept connections..."
for i in {1..30}; do
    if "$DOCKER_BIN" exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
        echo "==> Database ready after ${i}s."
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Disposable PostgreSQL failed to become ready."
        exit 1
    fi
done

echo "==> Running Spring Boot Flyway & JPA validation integration test via Maven..."
cd backend
./mvnw test -Dtest=DisposablePostgresFlywayIntegrationTest \
    -Dtest.disposable.postgres=true \
    -Dspring.datasource.url="jdbc:postgresql://localhost:${TEST_PORT}/${POSTGRES_DB}" \
    -Dspring.datasource.username="${POSTGRES_USER}" \
    -Dspring.datasource.password="${POSTGRES_PASSWORD}" \
    -Dspring.datasource.driver-class-name="org.postgresql.Driver" \
    -Dspring.flyway.enabled=true \
    -Dspring.jpa.hibernate.ddl-auto=validate

echo "==> Flyway Spring Boot PostgreSQL lifecycle test finished successfully!"

