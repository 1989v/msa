#!/usr/bin/env bash
# docker/backup/scripts/backup-postgres.sh
# Usage: backup-postgres.sh
#
# Performs a full pg_basebackup of a PostgreSQL database.
#
# 호출자 환경변수 (backup.env 또는 외부 주입):
#   PG_HOST       (예: quant-postgres)
#   PG_PORT       (기본 5432)
#   PG_USER       (예: quant)
#   PG_DATABASE   (예: quant)  — 디렉토리 라벨용
#   PG_PASSWORD
#
# (charting Hard remove 이후 default 값은 제거됨 — 호출 전에 환경변수가 모두 설정되어야 한다.
# quant pgvector 백업 등으로 재활용하려면 backup.env 에 PG_HOST 등을 명시.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

if [[ -z "${PG_HOST:-}" || -z "${PG_USER:-}" || -z "${PG_DATABASE:-}" ]]; then
    echo "PG_HOST / PG_USER / PG_DATABASE 가 모두 설정되어야 한다 (charting 제거 후 default 없음)." >&2
    exit 2
fi

DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
TARGET_DIR="${STAGING}/postgres/${PG_DATABASE}/${DATE}"

echo "[$(date '+%H:%M:%S')] Starting pg_basebackup: ${PG_DATABASE}@${PG_HOST}"

mkdir -p "$TARGET_DIR"

export PGPASSWORD="${PG_PASSWORD}"

# -Ft: tar format, -z: gzip compression, -Xs: stream WAL during backup
pg_basebackup \
    -h "${PG_HOST}" \
    -p "${PG_PORT:-5432}" \
    -U "${PG_USER}" \
    -D "$TARGET_DIR" \
    -Ft -z -Xs \
    -P \
    2>&1 | tail -5

unset PGPASSWORD

echo "[$(date '+%H:%M:%S')] pg_basebackup complete: ${TARGET_DIR}"

# Upload
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "postgres/${PG_DATABASE}/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: postgres/${PG_DATABASE}/${DATE}"
