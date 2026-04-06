#!/usr/bin/env bash
# docker/backup/scripts/backup-files.sh
# Usage: backup-files.sh
#
# Backs up gifticon images using rsync.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

DATE=$(date +%Y-%m-%d)
STAGING="${BACKUP_STAGING_DIR:-/backup}"
SRC="${GIFTICON_IMAGES_DIR:-/app/storage/gifticon-images}"
TARGET_DIR="${STAGING}/files/gifticon/${DATE}"

if [[ ! -d "$SRC" ]]; then
    echo "WARNING: Source directory not found: ${SRC}, skipping file backup"
    exit 0
fi

echo "[$(date '+%H:%M:%S')] Starting file backup: gifticon images"

mkdir -p "$TARGET_DIR"

rsync -az --delete "$SRC/" "$TARGET_DIR/"

echo "[$(date '+%H:%M:%S')] rsync complete: ${TARGET_DIR}"

# Upload
"${SCRIPT_DIR}/upload.sh" "$TARGET_DIR" "files/gifticon/${DATE}"

echo "[$(date '+%H:%M:%S')] Uploaded: files/gifticon/${DATE}"
