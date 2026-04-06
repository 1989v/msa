#!/usr/bin/env bash
# docker/backup/scripts/backup-postgres.sh
# Usage: backup-postgres.sh
#
# Performs a full pg_basebackup of the charting PostgreSQL database.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
TARGET_DIR="${STAGING}/postgres/charting/${DATE}"

echo "[$(date '+%H:%M:%S')] Starting pg_basebackup: charting"

mkdir -p "$TARGET_DIR"

export PGPASSWORD="${PG_PASSWORD}"

# -Ft: tar format, -z: gzip compression, -Xs: stream WAL during backup
pg_basebackup \
    -h "${PG_HOST:-charting-db}" \
    -p "${PG_PORT:-5432}" \
    -U "${PG_USER:-charting}" \
    -D "$TARGET_DIR" \
    -Ft -z -Xs \
    -P \
    2>&1 | tail -5

unset PGPASSWORD

echo "[$(date '+%H:%M:%S')] pg_basebackup complete: ${TARGET_DIR}"

# Upload
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "postgres/charting/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: postgres/charting/${DATE}"
