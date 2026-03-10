#!/bin/bash
# =============================================================================
# server-entrypoint.sh — Django Server Entrypoint with Diagnostic Logging
# =============================================================================
# Runs database migrations and starts the Django server.
# Provides structured, timestamped logging at each phase.
# =============================================================================

set -e  # Exit immediately if a command exits with a non-zero status

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SERVER] $1"
}

log_phase() {
    echo ""
    echo "================================================================"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SERVER] ━━━ $1 ━━━"
    echo "================================================================"
}

# --- Phase 1: Environment Validation ---
log_phase "ENVIRONMENT CHECK"

if [ -f "/app/.env" ]; then
    log "PASS: /app/.env file is mounted."
    # Verify a critical variable exists (DATABASE_NAME)
    if grep -q "DATABASE_NAME" /app/.env; then
        log "PASS: DATABASE_NAME found in .env file."
    else
        log "FAIL: DATABASE_NAME not found in .env file. Config may be incomplete."
        log "  Fix: Check that 'createEnvFile' in build.py generated all variables."
        exit 1
    fi
else
    log "FAIL: /app/.env file is missing. Django cannot start."
    log "  Fix: Ensure DOCKER_ENV_FILE is set and the .env is copied in Dockerfile.server."
    exit 1
fi

# --- Phase 2: Database Connectivity ---
log_phase "DATABASE CONNECTIVITY"

# Extract database host and port from env or use defaults
DB_HOST="${DATABASE_HOST:-db}"
DB_PORT="${DATABASE_PORT:-3306}"

log "Waiting for database at $DB_HOST:$DB_PORT..."

RETRY=0
MAX_RETRIES=90
while ! python -c "
import socket
try:
    s = socket.create_connection(('$DB_HOST', $DB_PORT), timeout=2)
    s.close()
    exit(0)
except Exception as e:
    exit(1)
" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        log "FAIL: Cannot reach database at $DB_HOST:$DB_PORT after $MAX_RETRIES attempts."
        log "  Fix: Check 'docker-compose -f .build-files/docker-compose.yml logs db'."
        exit 1
    fi
    log "Attempt $RETRY/$MAX_RETRIES — database not ready, retrying in 2s..."
    sleep 2
done

log "PASS: Database at $DB_HOST:$DB_PORT is reachable."

# --- Phase 3: Django Migrations ---
log_phase "MIGRATIONS"

log "Running makemigrations..."
python manage.py makemigrations api --noinput 2>&1 | while IFS= read -r line; do
    log "  makemigrations: $line"
done
MAKE_EXIT=${PIPESTATUS[0]}

if [ $MAKE_EXIT -ne 0 ]; then
    log "FAIL: makemigrations exited with code $MAKE_EXIT."
    log "  Fix: Check for model errors in apps/server/api/models.py."
    exit 1
fi
log "PASS: makemigrations completed successfully."

log "Running migrate..."
python manage.py migrate api --noinput 2>&1 | while IFS= read -r line; do
    log "  migrate: $line"
done
MIGRATE_EXIT=${PIPESTATUS[0]}

if [ $MIGRATE_EXIT -ne 0 ]; then
    log "FAIL: migrate exited with code $MIGRATE_EXIT."
    log "  Fix: Check database credentials and connectivity."
    exit 1
fi
log "PASS: migrate completed successfully."

# Show applied migration state
log "Current migration state:"
python manage.py showmigrations api 2>&1 | while IFS= read -r line; do
    log "  $line"
done

# --- Phase 4: Start Server ---
log_phase "STARTUP"
log "Launching Django server..."

# Execute the command passed as arguments (CMD in Dockerfile)
exec "$@"
