#!/usr/bin/env bash
# docker/backup/scripts/binlog-archive.sh
# Usage: binlog-archive.sh
#
# Archives binary logs from all MySQL masters to remote storage.
# Reads database list from databases.conf.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
DATE=$(date +%Y-%m-%d)
HOUR=$(date +%H)
ERRORS=0

while IFS='|' read -r db_name master_host master_port; do
    [[ "$db_name" =~ ^#.*$ || -z "$db_name" ]] && continue

    BINLOG_DIR="${STAGING}/mysql/${db_name}/binlog/${DATE}"
    mkdir -p "$BINLOG_DIR"

    echo "[$(date '+%H:%M:%S')] Archiving binlogs: ${db_name} from ${master_host}"

    # Flush logs to rotate and get a clean boundary
    mysql --host="$master_host" --port="$master_port" \
        --user="${MYSQL_BACKUP_USER:-root}" \
        --password="${MYSQL_BACKUP_PASSWORD}" \
        -e "FLUSH BINARY LOGS;" 2>/dev/null || true

    # Copy binary logs using mysqlbinlog
    mysqlbinlog \
        --host="$master_host" \
        --port="$master_port" \
        --user="${MYSQL_BACKUP_USER:-root}" \
        --password="${MYSQL_BACKUP_PASSWORD}" \
        --read-from-remote-server \
        --raw \
        --result-file="${BINLOG_DIR}/" \
        --to-last-log \
        mysql-bin.000001 \
        2>&1 | tail -3 || {
            echo "WARNING: binlog archive failed for ${db_name}" >&2
            ERRORS=$((ERRORS + 1))
            continue
        }

    # Upload
    "${SCRIPT_DIR}/upload.sh" "$BINLOG_DIR" "mysql/${db_name}/binlog/${DATE}"
    echo "[$(date '+%H:%M:%S')] Binlog archived: ${db_name}"

done < "${CONFIG_DIR}/databases.conf"

if [[ $ERRORS -gt 0 ]]; then
    "${SCRIPT_DIR}/notify.sh" "FAILURE" "Binlog archive: ${ERRORS} database(s) failed"
    exit 1
fi

echo "[$(date '+%H:%M:%S')] Binlog archive complete for all databases"
