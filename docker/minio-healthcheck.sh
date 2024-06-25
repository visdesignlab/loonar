#!/bin/sh
HEALTH_URL="http://minio:9000/minio/health/live"
RESPONSE_CODE=$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")

if [ "$RESPONSE_CODE" -ne 200 ]; then
  echo "Health check failed with response code $RESPONSE_CODE"
  exit 1
fi

echo "Health check passed with response code $RESPONSE_CODE"
exit 0