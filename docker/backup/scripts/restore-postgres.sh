#!/usr/bin/env bash
# docker/backup/scripts/restore-postgres.sh
# Usage: restore-postgres.sh --db <db_name> --date <YYYY-MM-DD>
#
# Restores a PostgreSQL database from pg_basebackup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

# --- Parse arguments ---
DB_NAME=""
BACKUP_DATE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --db) DB_NAME="$2"; shift 2 ;;
        --date) BACKUP_DATE="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ -z "$DB_NAME" || -z "$BACKUP_DATE" ]]; then
    echo "Usage: restore-postgres.sh --db <db_name> --date <YYYY-MM-DD>" >&2
    exit 1
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
BACKUP_DIR="${STAGING}/postgres/${DB_NAME}/${BACKUP_DATE}"

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "ERROR: Backup not found: ${BACKUP_DIR}" >&2
    exit 1
fi

CONTAINER="charting-db"
VOLUME_NAME="charting-db-data"
DATA_DIR="/var/lib/postgresql/data"

echo "========================================"
echo " PostgreSQL Restore: ${DB_NAME}"
echo " Backup Date: ${BACKUP_DATE}"
echo "========================================"
echo ""
echo "WARNING: This will STOP PostgreSQL and REPLACE its data."
echo "Press Ctrl+C within 10 seconds to abort..."
sleep 10

# --- Step 1: Stop PostgreSQL ---
echo "[$(date '+%H:%M:%S')] Stopping PostgreSQL: ${CONTAINER}"
docker stop "${CONTAINER}" || true

# --- Step 2: Clear data directory ---
echo "[$(date '+%H:%M:%S')] Clearing data directory"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    postgres:16 \
    bash -c "rm -rf ${DATA_DIR}/*"

# --- Step 3: Extract backup ---
echo "[$(date '+%H:%M:%S')] Extracting backup: ${BACKUP_DIR}"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    -v "${BACKUP_DIR}:/backup:ro" \
    postgres:16 \
    bash -c "cd ${DATA_DIR} && tar xzf /backup/base.tar.gz && chown -R postgres:postgres ${DATA_DIR}"

# --- Step 4: Start PostgreSQL ---
echo "[$(date '+%H:%M:%S')] Starting PostgreSQL: ${CONTAINER}"
docker start "${CONTAINER}"

# Wait for ready
for i in $(seq 1 30); do
    if docker exec "${CONTAINER}" pg_isready -U "${PG_USER:-charting}" -d "${DB_NAME}" 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] PostgreSQL is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "ERROR: PostgreSQL did not start within 30 seconds" >&2
        exit 1
    fi
    sleep 1
done

echo "========================================"
echo " Restore complete: ${DB_NAME}"
echo "========================================"
