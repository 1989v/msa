#!/usr/bin/env bash
# docker/backup/scripts/cleanup.sh
# Usage: cleanup.sh
#
# Removes backups older than retention period from local staging and remote storage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
FULL_DAYS="${FULL_BACKUP_RETENTION_DAYS:-7}"
BINLOG_DAYS="${BINLOG_RETENTION_DAYS:-2}"

echo "[$(date '+%H:%M:%S')] Starting cleanup (full: ${FULL_DAYS}d, binlog: ${BINLOG_DAYS}d)"

# --- Local cleanup ---

# MySQL full backups
for db_dir in "${STAGING}"/mysql/*/; do
    [[ -d "$db_dir" ]] || continue
    # Skip binlog subdirectory
    find "$db_dir" -maxdepth 1 -mindepth 1 -type d -not -name "binlog" -mtime +"$FULL_DAYS" -exec rm -rf {} + 2>/dev/null || true
done

# MySQL binlogs
for binlog_dir in "${STAGING}"/mysql/*/binlog/; do
    [[ -d "$binlog_dir" ]] || continue
    find "$binlog_dir" -maxdepth 1 -mindepth 1 -type d -mtime +"$BINLOG_DAYS" -exec rm -rf {} + 2>/dev/null || true
done

# PostgreSQL full backups
if [[ -d "${STAGING}/postgres" ]]; then
    find "${STAGING}/postgres" -maxdepth 2 -mindepth 2 -type d -mtime +"$FULL_DAYS" -exec rm -rf {} + 2>/dev/null || true
fi

# File backups
if [[ -d "${STAGING}/files" ]]; then
    find "${STAGING}/files" -maxdepth 2 -mindepth 2 -type d -mtime +"$FULL_DAYS" -exec rm -rf {} + 2>/dev/null || true
fi

echo "[$(date '+%H:%M:%S')] Local cleanup complete"

# --- Remote cleanup ---

# MySQL full backups per DB
while IFS='|' read -r db_name _ _; do
    [[ "$db_name" =~ ^#.*$ || -z "$db_name" ]] && continue
    "${SCRIPT_DIR}/upload.sh" --cleanup "mysql/${db_name}" "$FULL_DAYS"
    "${SCRIPT_DIR}/upload.sh" --cleanup "mysql/${db_name}/binlog" "$BINLOG_DAYS"
done < "${CONFIG_DIR}/databases.conf"

# PostgreSQL
"${SCRIPT_DIR}/upload.sh" --cleanup "postgres/charting" "$FULL_DAYS"

# Files
"${SCRIPT_DIR}/upload.sh" --cleanup "files/gifticon" "$FULL_DAYS"

echo "[$(date '+%H:%M:%S')] Remote cleanup complete"
