#!/usr/bin/env bash
# docker/backup/scripts/backup-full.sh
# Usage: backup-full.sh
#
# Daily full backup orchestrator.
# Runs MySQL backups (all databases), PostgreSQL backup, file backup, then cleanup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
ERRORS=0
RESULTS=()

echo "========================================"
echo " Full Backup Started: ${START_TIME}"
echo "========================================"

# --- MySQL backups ---
while IFS='|' read -r db_name master_host master_port; do
    [[ "$db_name" =~ ^#.*$ || -z "$db_name" ]] && continue

    if "${SCRIPT_DIR}/backup-mysql.sh" "$db_name" "$master_host" "$master_port"; then
        RESULTS+=("MySQL/${db_name}: OK")
    else
        RESULTS+=("MySQL/${db_name}: FAILED")
        ERRORS=$((ERRORS + 1))
    fi
done < "${CONFIG_DIR}/databases.conf"

# --- PostgreSQL backup ---
if "${SCRIPT_DIR}/backup-postgres.sh"; then
    RESULTS+=("PostgreSQL/charting: OK")
else
    RESULTS+=("PostgreSQL/charting: FAILED")
    ERRORS=$((ERRORS + 1))
fi

# --- File backup ---
if "${SCRIPT_DIR}/backup-files.sh"; then
    RESULTS+=("Files/gifticon: OK")
else
    RESULTS+=("Files/gifticon: FAILED")
    ERRORS=$((ERRORS + 1))
fi

# --- Cleanup ---
if "${SCRIPT_DIR}/cleanup.sh"; then
    RESULTS+=("Cleanup: OK")
else
    RESULTS+=("Cleanup: FAILED")
    ERRORS=$((ERRORS + 1))
fi

# --- Summary ---
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
SUMMARY=$(printf '%s\n' "${RESULTS[@]}")

echo "========================================"
echo " Full Backup Finished: ${END_TIME}"
echo " Results:"
printf '  %s\n' "${RESULTS[@]}"
echo "========================================"

if [[ $ERRORS -gt 0 ]]; then
    "${SCRIPT_DIR}/notify.sh" "FAILURE" "Full backup: ${ERRORS} task(s) failed\n${SUMMARY}"
    exit 1
else
    "${SCRIPT_DIR}/notify.sh" "SUCCESS" "Full backup completed successfully\n${SUMMARY}"
fi
