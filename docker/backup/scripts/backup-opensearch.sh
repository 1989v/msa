#!/usr/bin/env bash
# docker/backup/scripts/backup-opensearch.sh
# Usage: backup-opensearch.sh [backup_dir]
#
# Exports OpenSearch indices to local files via scroll API.
# Designed for local dev backup — not for production use.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

OPENSEARCH_HOST="${OPENSEARCH_HOST:-localhost}"
OPENSEARCH_PORT="${OPENSEARCH_PORT:-9210}"
OPENSEARCH_URL="http://${OPENSEARCH_HOST}:${OPENSEARCH_PORT}"

BACKUP_ROOT="${1:-${PROJECT_ROOT}/private/backups/opensearch}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

# Target indices to back up
INDICES=("concept-index")

echo "=== OpenSearch Backup — $(date '+%Y-%m-%d %H:%M:%S') ==="

# Check connectivity
if ! curl -sf "${OPENSEARCH_URL}/_cluster/health" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to OpenSearch at ${OPENSEARCH_URL}"
    exit 1
fi

mkdir -p "$BACKUP_DIR"
SUCCESS=0
FAIL=0

for INDEX in "${INDICES[@]}"; do
    echo -n "  Backing up index: ${INDEX}... "

    # 1. Save index settings & mappings
    SETTINGS_FILE="${BACKUP_DIR}/${INDEX}_settings.json"
    if curl -sf "${OPENSEARCH_URL}/${INDEX}" | python3 -m json.tool > "$SETTINGS_FILE" 2>/dev/null; then
        :
    else
        echo "FAIL (settings)"
        ((FAIL++))
        continue
    fi

    # 2. Export all documents via scroll API
    DATA_FILE="${BACKUP_DIR}/${INDEX}_data.ndjson"
    SCROLL_ID=""
    DOC_COUNT=0

    # Initial scroll request
    RESPONSE=$(curl -sf "${OPENSEARCH_URL}/${INDEX}/_search?scroll=5m" \
        -H 'Content-Type: application/json' \
        -d '{"size": 500, "query": {"match_all": {}}}')

    SCROLL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('_scroll_id',''))" 2>/dev/null)
    HITS=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
hits = data.get('hits', {}).get('hits', [])
for h in hits:
    action = json.dumps({'index': {'_id': h['_id']}})
    doc = json.dumps(h['_source'])
    print(action)
    print(doc)
print(len(hits), file=sys.stderr)
" 2>"${BACKUP_DIR}/.count_tmp")

    echo "$HITS" > "$DATA_FILE"
    BATCH_COUNT=$(cat "${BACKUP_DIR}/.count_tmp" 2>/dev/null || echo "0")
    DOC_COUNT=$((DOC_COUNT + BATCH_COUNT))

    # Continue scrolling
    while [[ "$BATCH_COUNT" -gt 0 && -n "$SCROLL_ID" ]]; do
        RESPONSE=$(curl -sf "${OPENSEARCH_URL}/_search/scroll" \
            -H 'Content-Type: application/json' \
            -d "{\"scroll\": \"5m\", \"scroll_id\": \"${SCROLL_ID}\"}")

        SCROLL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('_scroll_id',''))" 2>/dev/null)
        HITS=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
hits = data.get('hits', {}).get('hits', [])
for h in hits:
    action = json.dumps({'index': {'_id': h['_id']}})
    doc = json.dumps(h['_source'])
    print(action)
    print(doc)
print(len(hits), file=sys.stderr)
" 2>"${BACKUP_DIR}/.count_tmp")

        BATCH_COUNT=$(cat "${BACKUP_DIR}/.count_tmp" 2>/dev/null || echo "0")
        if [[ "$BATCH_COUNT" -gt 0 ]]; then
            echo "$HITS" >> "$DATA_FILE"
            DOC_COUNT=$((DOC_COUNT + BATCH_COUNT))
        fi
    done

    rm -f "${BACKUP_DIR}/.count_tmp"

    # Clear scroll
    if [[ -n "$SCROLL_ID" ]]; then
        curl -sf -X DELETE "${OPENSEARCH_URL}/_search/scroll" \
            -H 'Content-Type: application/json' \
            -d "{\"scroll_id\": \"${SCROLL_ID}\"}" > /dev/null 2>&1 || true
    fi

    # Compress data file
    gzip "$DATA_FILE"
    SIZE=$(du -h "${DATA_FILE}.gz" | cut -f1)
    echo "OK (${DOC_COUNT} docs, ${SIZE})"
    ((SUCCESS++))
done

# Write metadata
cat > "${BACKUP_DIR}/metadata.json" <<JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "opensearch-scroll-export",
  "indices": ${SUCCESS},
  "failed": ${FAIL}
}
JSONEOF

echo "=== Done: ${SUCCESS} success, ${FAIL} fail — ${BACKUP_DIR} ==="
exit $FAIL
