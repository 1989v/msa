#!/usr/bin/env bash
# k3d-mysql-dump.sh — k3d 클러스터의 MySQL 전체 데이터를 로컬에 스냅샷
#
# Usage: scripts/k3d-mysql-dump.sh [backup_dir]
# Default: private/backups/mysql/<timestamp>/
#
# databases.conf 기반으로 모든 DB를 mysqldump → gzip.
# k3d-down.sh에서 클러스터 삭제 전 자동 호출됨.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATABASES_CONF="${REPO_ROOT}/docker/backup/config/databases.conf"
BACKUP_ROOT="${1:-${REPO_ROOT}/private/backups/mysql}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-localroot}"
NAMESPACE="commerce"
MYSQL_POD="mysql-0"

if [[ ! -f "$DATABASES_CONF" ]]; then
    echo "ERROR: databases.conf not found at ${DATABASES_CONF}"
    exit 1
fi

# Check if MySQL pod is accessible
if ! kubectl -n "$NAMESPACE" get pod "$MYSQL_POD" &>/dev/null; then
    echo "WARN: $MYSQL_POD not found — skipping dump."
    exit 0
fi

mkdir -p "$BACKUP_DIR"

SUCCESS=0
FAIL=0
echo "▸ MySQL snapshot — $(date '+%Y-%m-%d %H:%M:%S')"

while IFS='|' read -r DB_NAME MASTER_HOST MASTER_PORT; do
    [[ "$DB_NAME" =~ ^#.*$ || -z "$DB_NAME" ]] && continue

    DUMP_FILE="${BACKUP_DIR}/${DB_NAME}.sql.gz"
    echo -n "  $DB_NAME ... "

    if kubectl -n "$NAMESPACE" exec "$MYSQL_POD" -- \
        mysqldump -u root -p"${MYSQL_PWD}" \
        --single-transaction --routines --triggers \
        --set-gtid-purged=OFF \
        "$DB_NAME" 2>/dev/null | gzip > "$DUMP_FILE"; then
        SIZE=$(du -h "$DUMP_FILE" | cut -f1)
        echo "OK (${SIZE})"
        ((SUCCESS++))
    else
        echo "FAIL"
        rm -f "$DUMP_FILE"
        ((FAIL++))
    fi
done < "$DATABASES_CONF"

# Write metadata
cat > "${BACKUP_DIR}/metadata.json" <<JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "k3d-mysqldump",
  "databases": ${SUCCESS},
  "failed": ${FAIL}
}
JSONEOF

# Symlink latest for easy restore
ln -sfn "$BACKUP_DIR" "${BACKUP_ROOT}/latest"

echo "▸ Done: ${SUCCESS} success, ${FAIL} fail → ${BACKUP_DIR}"
echo "▸ Latest symlink: ${BACKUP_ROOT}/latest"
exit $FAIL
