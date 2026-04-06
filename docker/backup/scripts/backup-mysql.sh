#!/usr/bin/env bash
# docker/backup/scripts/backup-mysql.sh
# Usage: backup-mysql.sh <db_name> <master_host> <master_port>
#
# Performs a full XtraBackup of the specified MySQL database.
# Outputs the backup directory path on success.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

DB_NAME="$1"
MASTER_HOST="$2"
MASTER_PORT="$3"
DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
TARGET_DIR="${STAGING}/mysql/${DB_NAME}/${DATE}"

echo "[$(date '+%H:%M:%S')] Starting XtraBackup: ${DB_NAME} from ${MASTER_HOST}:${MASTER_PORT}"

# 1. Backup
mkdir -p "$TARGET_DIR"
xtrabackup --backup \
    --host="$MASTER_HOST" \
    --port="$MASTER_PORT" \
    --user="${MYSQL_BACKUP_USER:-root}" \
    --password="${MYSQL_BACKUP_PASSWORD}" \
    --databases="$DB_NAME" \
    --target-dir="$TARGET_DIR" \
    --no-timestamp \
    2>&1 | tail -5

# 2. Prepare (apply logs for consistency)
xtrabackup --prepare \
    --target-dir="$TARGET_DIR" \
    2>&1 | tail -3

echo "[$(date '+%H:%M:%S')] XtraBackup complete: ${TARGET_DIR}"

# 3. Upload to remote storage
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "mysql/${DB_NAME}/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: mysql/${DB_NAME}/${DATE}"
