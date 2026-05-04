#!/usr/bin/env bash
# docker/backup/scripts/backup-full.sh
# Usage: backup-full.sh
#
# Daily full backup orchestrator.
# Runs MySQL backups (all databases), file backup, then cleanup.
# (PostgreSQL/charting 백업은 ADR-0036 P2-T20 charting Hard remove 와 함께 폐기됨, 2026-05-02.
# quant pgvector 백업이 필요하면 backup-postgres.sh 를 quant-postgres 호스트로 재활용 가능.)

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

# --- PostgreSQL backup (현재 비활성) ---
# charting 서비스가 quant 로 통합 후 Hard remove 되어 PostgreSQL 영구 데이터 부재.
# quant pgvector 도입 시 PG_HOST=quant-postgres 등으로 환경변수 갱신 후 아래 블록 활성화.
#
# if "${SCRIPT_DIR}/backup-postgres.sh"; then
#     RESULTS+=("PostgreSQL: OK")
# else
#     RESULTS+=("PostgreSQL: FAILED")
#     ERRORS=$((ERRORS + 1))
# fi

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
