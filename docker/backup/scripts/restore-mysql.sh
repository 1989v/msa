#!/usr/bin/env bash
# docker/backup/scripts/restore-mysql.sh
# Usage:
#   restore-mysql.sh --db <db_name> --date <YYYY-MM-DD>
#   restore-mysql.sh --db <db_name> --date <YYYY-MM-DD> --pitr "YYYY-MM-DD HH:MM:SS"
#
# Restores a MySQL database from XtraBackup, optionally applying binlog up to a point-in-time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

# --- Parse arguments ---
DB_NAME=""
BACKUP_DATE=""
PITR_TIMESTAMP=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --db) DB_NAME="$2"; shift 2 ;;
        --date) BACKUP_DATE="$2"; shift 2 ;;
        --pitr) PITR_TIMESTAMP="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ -z "$DB_NAME" || -z "$BACKUP_DATE" ]]; then
    echo "Usage: restore-mysql.sh --db <db_name> --date <YYYY-MM-DD> [--pitr <timestamp>]" >&2
    exit 1
fi

STAGING="${BACKUP_STAGING_DIR:-/backup}"
BACKUP_DIR="${STAGING}/mysql/${DB_NAME}/${BACKUP_DATE}"

# --- Resolve master host from databases.conf ---
MASTER_HOST=""
MASTER_PORT=""
while IFS='|' read -r name host port; do
    [[ "$name" =~ ^#.*$ || -z "$name" ]] && continue
    if [[ "$name" == "$DB_NAME" ]]; then
        MASTER_HOST="$host"
        MASTER_PORT="$port"
        break
    fi
done < "${CONFIG_DIR}/databases.conf"

if [[ -z "$MASTER_HOST" ]]; then
    echo "ERROR: Database ${DB_NAME} not found in databases.conf" >&2
    exit 1
fi

# --- Download backup if not present locally ---
if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "Backup not found locally, downloading from remote storage..."
    echo "ERROR: Local backup not found: ${BACKUP_DIR}" >&2
    echo "Please manually download the backup to ${BACKUP_DIR} first." >&2
    exit 1
fi

echo "========================================"
echo " MySQL Restore: ${DB_NAME}"
echo " Backup Date: ${BACKUP_DATE}"
echo " PITR Target: ${PITR_TIMESTAMP:-N/A (full backup only)}"
echo "========================================"
echo ""
echo "WARNING: This will STOP the MySQL instance and REPLACE its data."
echo "Press Ctrl+C within 10 seconds to abort..."
sleep 10

# --- Step 1: Stop MySQL ---
echo "[$(date '+%H:%M:%S')] Stopping MySQL: ${MASTER_HOST}"
docker stop "${MASTER_HOST}" || true

# --- Step 2: Clear data directory ---
VOLUME_NAME="mysql-${DB_NAME//_/-}-master-data"
DATA_DIR="/var/lib/mysql"

echo "[$(date '+%H:%M:%S')] Clearing data directory"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    mysql:8.0 \
    bash -c "rm -rf ${DATA_DIR}/*"

# --- Step 3: Copy backup to data directory ---
echo "[$(date '+%H:%M:%S')] Restoring from backup: ${BACKUP_DIR}"
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    -v "${BACKUP_DIR}:/backup:ro" \
    percona/percona-xtrabackup:8.0 \
    xtrabackup --copy-back --target-dir=/backup --datadir="${DATA_DIR}"

# Fix permissions
docker run --rm \
    -v "${VOLUME_NAME}:${DATA_DIR}" \
    mysql:8.0 \
    chown -R mysql:mysql "${DATA_DIR}"

# --- Step 4: Start MySQL ---
echo "[$(date '+%H:%M:%S')] Starting MySQL: ${MASTER_HOST}"
docker start "${MASTER_HOST}"

# Wait for MySQL to be ready
echo "[$(date '+%H:%M:%S')] Waiting for MySQL to be ready..."
for i in $(seq 1 30); do
    if docker exec "${MASTER_HOST}" mysqladmin ping -u root -p"${MYSQL_BACKUP_PASSWORD}" --silent 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] MySQL is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "ERROR: MySQL did not start within 30 seconds" >&2
        exit 1
    fi
    sleep 1
done

# --- Step 5: PITR (optional) ---
if [[ -n "$PITR_TIMESTAMP" ]]; then
    BINLOG_DIR="${STAGING}/mysql/${DB_NAME}/binlog/${BACKUP_DATE}"

    if [[ ! -d "$BINLOG_DIR" ]]; then
        echo "WARNING: Binlog directory not found: ${BINLOG_DIR}" >&2
        echo "PITR skipped. Database restored to backup point only." >&2
        exit 0
    fi

    echo "[$(date '+%H:%M:%S')] Applying binlog up to: ${PITR_TIMESTAMP}"

    # Find binlog files and replay up to the target timestamp
    BINLOG_FILES=$(find "$BINLOG_DIR" -name "mysql-bin.*" -not -name "*.index" | sort)

    if [[ -n "$BINLOG_FILES" ]]; then
        mysqlbinlog \
            --database="$DB_NAME" \
            --stop-datetime="$PITR_TIMESTAMP" \
            $BINLOG_FILES \
        | docker exec -i "${MASTER_HOST}" \
            mysql -u root -p"${MYSQL_BACKUP_PASSWORD}"

        echo "[$(date '+%H:%M:%S')] PITR complete: restored to ${PITR_TIMESTAMP}"
    else
        echo "WARNING: No binlog files found in ${BINLOG_DIR}" >&2
    fi
fi

echo "========================================"
echo " Restore complete: ${DB_NAME}"
echo "========================================"
