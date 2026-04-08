#!/usr/bin/env bash
# docker/backup/scripts/backup-local-dump.sh
# Usage: backup-local-dump.sh [backup_dir]
#
# Lightweight mysqldump backup for local dev.
# Dumps all databases listed in databases.conf via Docker exec.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Load env
DOCKER_ENV="${PROJECT_ROOT}/docker/.env"
if [[ -f "$DOCKER_ENV" ]]; then
    set -a; source "$DOCKER_ENV"; set +a
fi

BACKUP_ROOT="${1:-${PROJECT_ROOT}/private/backups/mysql}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
DATABASES_CONF="${CONFIG_DIR}/databases.conf"

if [[ ! -f "$DATABASES_CONF" ]]; then
    echo "ERROR: databases.conf not found at ${DATABASES_CONF}"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-commerce_root_pw_2024}"
SUCCESS=0
FAIL=0

echo "=== MySQL Dump Backup — $(date '+%Y-%m-%d %H:%M:%S') ==="

while IFS='|' read -r DB_NAME MASTER_HOST MASTER_PORT; do
    # skip comments and empty lines
    [[ "$DB_NAME" =~ ^#.*$ || -z "$DB_NAME" ]] && continue

    DUMP_FILE="${BACKUP_DIR}/${DB_NAME}.sql.gz"
    echo -n "  Dumping ${DB_NAME} from ${MASTER_HOST}... "

    if docker exec "$MASTER_HOST" mysqldump \
        -u root \
        -p"${MYSQL_PWD}" \
        --single-transaction \
        --routines \
        --triggers \
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

echo "=== Done: ${SUCCESS} success, ${FAIL} fail — ${BACKUP_DIR} ==="

# Write metadata
cat > "${BACKUP_DIR}/metadata.json" <<JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "mysqldump",
  "databases": ${SUCCESS},
  "failed": ${FAIL}
}
JSONEOF

exit $FAIL
