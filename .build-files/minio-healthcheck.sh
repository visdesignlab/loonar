#!/bin/sh
# =============================================================================
# minio-healthcheck.sh — MinIO Health Check with Diagnostics
# =============================================================================
# Used by Docker Compose healthcheck. Verifies MinIO API is alive and
# the /data directory is accessible.
# =============================================================================

HEALTH_URL="http://minio:9000/minio/health/live"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# --- Check 1: MinIO API liveness ---
RESPONSE=$(curl --max-time 5 -s -w '\n%{http_code}' "$HEALTH_URL" 2>&1)
CURL_EXIT=$?
RESPONSE_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

if [ $CURL_EXIT -ne 0 ]; then
    echo "[$TIMESTAMP] HEALTHCHECK FAIL: curl failed with exit code $CURL_EXIT"
    echo "[$TIMESTAMP]   curl error output: $RESPONSE_BODY"
    echo "[$TIMESTAMP]   Possible cause: MinIO process not started or port 9000 not bound."
    exit 1
fi

if [ "$RESPONSE_CODE" -ne 200 ]; then
    echo "[$TIMESTAMP] HEALTHCHECK FAIL: MinIO API returned HTTP $RESPONSE_CODE (expected 200)"
    echo "[$TIMESTAMP]   Response body: $RESPONSE_BODY"
    echo "[$TIMESTAMP]   Possible cause: MinIO is starting up or in degraded state."
    exit 1
fi

# --- Check 2: /data directory accessibility ---
if [ ! -d "/data" ]; then
    echo "[$TIMESTAMP] HEALTHCHECK FAIL: /data directory does not exist inside container."
    echo "[$TIMESTAMP]   Possible cause: Volume mount missing. Check MINIO_VOLUME_LOCATION in config."
    exit 1
fi

if [ ! -r "/data" ]; then
    echo "[$TIMESTAMP] HEALTHCHECK FAIL: /data directory is not readable."
    echo "[$TIMESTAMP]   Possible cause: ZFS dataset permissions on TrueNAS. Check chown/chmod."
    exit 1
fi

# Verify write access by attempting to create and remove a temp file
PROBE_FILE="/data/.healthcheck_probe_$$"
if touch "$PROBE_FILE" 2>/dev/null; then
    rm -f "$PROBE_FILE"
else
    echo "[$TIMESTAMP] HEALTHCHECK FAIL: /data directory is not writable."
    echo "[$TIMESTAMP]   Possible cause: Read-only mount or insufficient permissions."
    echo "[$TIMESTAMP]   On TrueNAS NFS: check userGroupPermissions in minioSettings."
    exit 1
fi

echo "[$TIMESTAMP] HEALTHCHECK PASS: MinIO API healthy, /data readable and writable."
exit 0