#!/usr/bin/env bash
# k3d-mysql-restore.sh — 로컬 백업에서 k3d MySQL로 데이터 복구
#
# Usage:
#   scripts/k3d-mysql-restore.sh                 # latest 심볼릭 링크 사용
#   scripts/k3d-mysql-restore.sh <backup_dir>    # 특정 백업 디렉토리
#
# k3d-up.sh에서 MySQL Ready 후 자동 호출됨.
# 이미 Flyway가 실행되어 스키마가 있는 상태에서 데이터만 덮어씁니다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATABASES_CONF="${REPO_ROOT}/docker/backup/config/databases.conf"
BACKUP_ROOT="${REPO_ROOT}/private/backups/mysql"
BACKUP_DIR="${1:-${BACKUP_ROOT}/latest}"
MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-localroot}"
NAMESPACE="commerce"
MYSQL_POD="mysql-0"

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "▸ No backup found at ${BACKUP_DIR} — skipping restore."
    echo "  (Flyway seed data will be used for initial concepts.)"
    exit 0
fi

if [[ ! -f "${BACKUP_DIR}/metadata.json" ]]; then
    echo "▸ No metadata.json in ${BACKUP_DIR} — not a valid backup."
    exit 0
fi

BACKUP_TS=$(python3 -c "import json; print(json.load(open('${BACKUP_DIR}/metadata.json'))['timestamp'])" 2>/dev/null || echo "unknown")
echo "▸ Restoring from backup: ${BACKUP_DIR}"
echo "  Backup timestamp: ${BACKUP_TS}"

SUCCESS=0
FAIL=0

while IFS='|' read -r DB_NAME MASTER_HOST MASTER_PORT; do
    [[ "$DB_NAME" =~ ^#.*$ || -z "$DB_NAME" ]] && continue

    DUMP_FILE="${BACKUP_DIR}/${DB_NAME}.sql.gz"
    if [[ ! -f "$DUMP_FILE" ]]; then
        echo "  $DB_NAME — no dump file, skip"
        continue
    fi

    SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    echo -n "  $DB_NAME (${SIZE}) ... "

    if gunzip -c "$DUMP_FILE" | \
        kubectl -n "$NAMESPACE" exec -i "$MYSQL_POD" -- \
        mysql -u root -p"${MYSQL_PWD}" "$DB_NAME" 2>/dev/null; then
        echo "OK"
        ((SUCCESS++))
    else
        echo "FAIL"
        ((FAIL++))
    fi
done < "$DATABASES_CONF"

echo "▸ Restore done: ${SUCCESS} success, ${FAIL} fail"
exit $FAIL
