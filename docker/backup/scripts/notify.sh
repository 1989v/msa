#!/usr/bin/env bash
# docker/backup/scripts/notify.sh
# Usage: notify.sh <status> <message>
#   status: SUCCESS | FAILURE
#   message: 알림 본문

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STATUS="${1:-UNKNOWN}"
MESSAGE="${2:-No message}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
HOSTNAME=$(hostname)

if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
    echo "[${TIMESTAMP}] [${STATUS}] ${MESSAGE} (no webhook configured, skipping alert)"
    exit 0
fi

ICON="✅"
if [[ "$STATUS" == "FAILURE" ]]; then
    ICON="🚨"
fi

PAYLOAD=$(cat <<EOJSON
{
    "text": "${ICON} *Backup ${STATUS}*\nHost: ${HOSTNAME}\nTime: ${TIMESTAMP}\n${MESSAGE}"
}
EOJSON
)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
    echo "[${TIMESTAMP}] Alert sent (HTTP ${HTTP_CODE})"
else
    echo "[${TIMESTAMP}] WARNING: Alert failed (HTTP ${HTTP_CODE})" >&2
fi
