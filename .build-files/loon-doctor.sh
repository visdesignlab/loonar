#!/bin/bash
# =============================================================================
# loon-doctor.sh — Loonar Deployment Diagnostics
# =============================================================================
# Run this script from the repository root to diagnose the full Loonar stack.
#
# Usage:
#   bash .build-files/loon-doctor.sh
#
# Each check prints [PASS] or [FAIL] with actionable guidance.
# =============================================================================

set -o pipefail

COMPOSE_FILE=".build-files/docker-compose.yml"
PASS="\033[32m[PASS]\033[0m"
FAIL="\033[31m[FAIL]\033[0m"
WARN="\033[33m[WARN]\033[0m"
INFO="\033[36m[INFO]\033[0m"
BOLD="\033[1m"
RESET="\033[0m"

FAILURES=0
WARNINGS=0

timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

pass() {
    echo -e "$(timestamp) $PASS $1"
}

fail() {
    echo -e "$(timestamp) $FAIL $1"
    FAILURES=$((FAILURES + 1))
}

warn() {
    echo -e "$(timestamp) $WARN $1"
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo -e "$(timestamp) $INFO $1"
}

header() {
    echo ""
    echo -e "${BOLD}━━━ $1 ━━━${RESET}"
}

# =============================================================================
header "1. Docker Compose — Container Status"
# =============================================================================

if [ ! -f "$COMPOSE_FILE" ]; then
    fail "Docker Compose file not found at $COMPOSE_FILE"
    echo "     ↳ Fix: Run 'python3 build.py --config-file .build-files/config-standard.json' first."
else
    pass "Docker Compose file exists at $COMPOSE_FILE"
fi

EXPECTED_SERVICES=("client" "server" "celery" "db" "redis" "minio" "duckdb")

RUNNING_SERVICES=$(docker-compose -f "$COMPOSE_FILE" ps --services --filter "status=running" 2>/dev/null)
if [ $? -ne 0 ]; then
    fail "Cannot query Docker Compose. Is Docker running?"
    echo "     ↳ Fix: Ensure Docker daemon is running. On TrueNAS, check 'Apps' service status."
else
    for svc in "${EXPECTED_SERVICES[@]}"; do
        if echo "$RUNNING_SERVICES" | grep -qw "$svc"; then
            pass "Container '$svc' is running."
        else
            # Check if it exited
            EXITED=$(docker-compose -f "$COMPOSE_FILE" ps --services --filter "status=exited" 2>/dev/null | grep -w "$svc")
            if [ -n "$EXITED" ]; then
                fail "Container '$svc' has EXITED (crashed)."
                echo "     ↳ Fix: Run 'docker-compose -f $COMPOSE_FILE logs $svc' to see crash reason."
            else
                fail "Container '$svc' is NOT running and not found."
                echo "     ↳ Fix: Was it included in the build? Check docker-compose.yml services."
            fi
        fi
    done
fi

# =============================================================================
header "2. MySQL — Database Connectivity"
# =============================================================================

DB_PING=$(docker-compose -f "$COMPOSE_FILE" exec -T db mysqladmin ping -h localhost -u root -p"${DATABASE_ROOT_PASSWORD:-root_pass}" 2>&1)
if echo "$DB_PING" | grep -qi "alive"; then
    pass "MySQL is alive and responding to ping."
else
    fail "MySQL is NOT responding."
    echo "     ↳ Output: $DB_PING"
    echo "     ↳ Fix: Check 'docker-compose -f $COMPOSE_FILE logs db' for startup errors."
fi

# Check if the loon database exists
DB_CHECK=$(docker-compose -f "$COMPOSE_FILE" exec -T db mysql -u root -p"${DATABASE_ROOT_PASSWORD:-root_pass}" -e "SHOW DATABASES LIKE 'loon';" 2>&1)
if echo "$DB_CHECK" | grep -qi "loon"; then
    pass "Database 'loon' exists."
else
    fail "Database 'loon' does NOT exist."
    echo "     ↳ Output: $DB_CHECK"
    echo "     ↳ Fix: Check DATABASE_NAME in your config and .env file."
fi

# =============================================================================
header "3. Redis — Broker Connectivity"
# =============================================================================

REDIS_PONG=$(docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>&1)
if echo "$REDIS_PONG" | grep -qi "PONG"; then
    pass "Redis is responding (PONG)."
else
    fail "Redis is NOT responding."
    echo "     ↳ Output: $REDIS_PONG"
    echo "     ↳ Fix: Run 'docker-compose -f $COMPOSE_FILE logs redis'."
fi

# =============================================================================
header "4. MinIO — API Health"
# =============================================================================

MINIO_HEALTH=$(docker-compose -f "$COMPOSE_FILE" exec -T minio curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:9000/minio/health/live 2>&1)
if [ "$MINIO_HEALTH" = "200" ]; then
    pass "MinIO health endpoint returned 200 OK."
else
    fail "MinIO health endpoint returned: $MINIO_HEALTH"
    echo "     ↳ Fix: Run 'docker-compose -f $COMPOSE_FILE logs minio' for details."
    echo "     ↳ Common cause on TrueNAS: ZFS dataset permissions or NFS mount failure."
fi

# =============================================================================
header "5. MinIO — Data Directory & Bucket"
# =============================================================================

# Check /data is readable inside minio container
DATA_DIR_CHECK=$(docker-compose -f "$COMPOSE_FILE" exec -T minio ls -la /data 2>&1)
if [ $? -eq 0 ]; then
    pass "MinIO /data directory is accessible."
else
    fail "MinIO /data directory is NOT accessible."
    echo "     ↳ Output: $DATA_DIR_CHECK"
    echo "     ↳ Fix: Verify MINIO_VOLUME_LOCATION in config points to a readable directory."
    echo "     ↳ On TrueNAS: Check ZFS dataset permissions (chown/chmod on the dataset)."
fi

# Check if the 'data' bucket directory exists
BUCKET_CHECK=$(docker-compose -f "$COMPOSE_FILE" exec -T minio ls /data/data 2>&1)
if [ $? -eq 0 ]; then
    pass "MinIO 'data' bucket directory exists at /data/data."
else
    warn "MinIO 'data' bucket directory not found at /data/data."
    echo "     ↳ This is expected on a fresh deployment before any experiments are uploaded."
    echo "     ↳ If experiments have been uploaded, check MinIO logs for write permission issues."
fi

# =============================================================================
header "6. MinIO — aa_index.json Validation"
# =============================================================================

# Try to read aa_index.json via mc or direct file access
AA_INDEX_CONTENT=$(docker-compose -f "$COMPOSE_FILE" exec -T minio cat /data/data/aa_index.json 2>&1)
if [ $? -eq 0 ]; then
    pass "aa_index.json file exists in MinIO bucket."

    # Validate it's valid JSON
    echo "$AA_INDEX_CONTENT" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null
    if [ $? -eq 0 ]; then
        pass "aa_index.json is valid JSON."

        # Count experiments
        EXP_COUNT=$(echo "$AA_INDEX_CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
experiments = data.get('experiments', [])
print(len(experiments))
" 2>/dev/null)
        if [ "$EXP_COUNT" -gt 0 ] 2>/dev/null; then
            pass "aa_index.json lists $EXP_COUNT experiment(s)."
        else
            warn "aa_index.json lists 0 experiments."
            echo "     ↳ This is expected on a fresh deployment with no uploaded data."
        fi
    else
        fail "aa_index.json exists but is NOT valid JSON."
        echo "     ↳ Content preview: $(echo "$AA_INDEX_CONTENT" | head -5)"
        echo "     ↳ Fix: The file may be corrupted. Re-upload an experiment to regenerate it."
    fi
else
    warn "aa_index.json not found in MinIO bucket."
    echo "     ↳ This is expected on a fresh deployment. Upload an experiment to create it."
    echo "     ↳ If this is NOT a fresh deployment, check that the MinIO volume is mounted correctly."
fi

# =============================================================================
header "7. MinIO — Experiment File Verification"
# =============================================================================

if [ -n "$AA_INDEX_CONTENT" ] && echo "$AA_INDEX_CONTENT" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
    EXPERIMENTS=$(echo "$AA_INDEX_CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for exp in data.get('experiments', []):
    print(exp)
" 2>/dev/null)

    if [ -n "$EXPERIMENTS" ]; then
        MISSING=0
        TOTAL=0
        while IFS= read -r exp_file; do
            TOTAL=$((TOTAL + 1))
            FILE_CHECK=$(docker-compose -f "$COMPOSE_FILE" exec -T minio ls "/data/data/$exp_file" 2>&1)
            if [ $? -eq 0 ]; then
                pass "Experiment file '$exp_file' exists."
            else
                fail "Experiment file '$exp_file' listed in aa_index.json but NOT found in MinIO."
                echo "     ↳ Fix: The experiment data may have been deleted. Re-upload or remove from index."
                MISSING=$((MISSING + 1))
            fi
        done <<< "$EXPERIMENTS"

        if [ $MISSING -eq 0 ] && [ $TOTAL -gt 0 ]; then
            pass "All $TOTAL experiment file(s) verified."
        fi
    else
        info "No experiments listed — skipping file verification."
    fi
else
    info "Skipping experiment file verification (no valid aa_index.json)."
fi

# =============================================================================
header "8. NGINX — Client Proxy Check"
# =============================================================================

# Check if we can reach the client on port 80
CLIENT_CHECK=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:80/ 2>&1)
if [ "$CLIENT_CHECK" = "200" ]; then
    pass "NGINX client is serving on port 80."
else
    warn "NGINX client returned HTTP $CLIENT_CHECK on port 80."
    echo "     ↳ On TrueNAS, the host port may be mapped differently. Verify LOCAL_PORT_1 in config."
    echo "     ↳ Fix: Run 'docker-compose -f $COMPOSE_FILE logs client'."
fi

# Check if /data proxy works (MinIO through NGINX)
DATA_PROXY_CHECK=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:80/data/aa_index.json 2>&1)
if [ "$DATA_PROXY_CHECK" = "200" ]; then
    pass "NGINX /data proxy → MinIO is working (aa_index.json reachable)."
elif [ "$DATA_PROXY_CHECK" = "404" ]; then
    warn "NGINX /data proxy returned 404 for aa_index.json."
    echo "     ↳ MinIO may be up but the 'data' bucket or aa_index.json doesn't exist yet."
else
    fail "NGINX /data proxy returned HTTP $DATA_PROXY_CHECK."
    echo "     ↳ Fix: Check NGINX config and MinIO connectivity."
    echo "     ↳ Run: 'docker-compose -f $COMPOSE_FILE logs client'"
fi

# =============================================================================
header "9. Django — Server API Check"
# =============================================================================

API_CHECK=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:8000/api/ 2>&1)
if [ "$API_CHECK" = "200" ] || [ "$API_CHECK" = "301" ] || [ "$API_CHECK" = "404" ]; then
    pass "Django server is responding on port 8000 (HTTP $API_CHECK)."
else
    fail "Django server is NOT responding (HTTP $API_CHECK)."
    echo "     ↳ Fix: Run 'docker-compose -f $COMPOSE_FILE logs server' to see startup errors."
    echo "     ↳ Common causes: migration failure, missing .env, database not ready."
fi

# =============================================================================
header "SUMMARY"
# =============================================================================

echo ""
if [ $FAILURES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${BOLD}\033[32m✔ All checks passed. Loonar deployment looks healthy.${RESET}"
elif [ $FAILURES -eq 0 ]; then
    echo -e "${BOLD}\033[33m⚠ $WARNINGS warning(s) found, but no critical failures.${RESET}"
    echo "  Warnings are typically expected on fresh deployments with no data."
else
    echo -e "${BOLD}\033[31m✘ $FAILURES failure(s) and $WARNINGS warning(s) detected.${RESET}"
    echo "  Review the [FAIL] items above. Each includes a fix suggestion."
    echo ""
    echo "  Quick reference — view container logs:"
    echo "    docker-compose -f $COMPOSE_FILE logs <service>"
    echo ""
    echo "  Quick reference — restart a service:"
    echo "    docker-compose -f $COMPOSE_FILE restart <service>"
fi
echo ""
