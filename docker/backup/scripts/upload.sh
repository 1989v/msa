#!/usr/bin/env bash
# docker/backup/scripts/upload.sh
# Usage: upload.sh <local_path> <remote_path>
#   Uploads a file or directory to the configured storage provider.
# Usage: upload.sh --cleanup <prefix> <retention_days>
#   Removes backups older than retention_days under the given prefix.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"

# Load config
if [[ -f "${CONFIG_DIR}/backup.env" ]]; then
    set -a; source "${CONFIG_DIR}/backup.env"; set +a
fi

STORAGE_PROVIDER="${STORAGE_PROVIDER:-local}"
PROVIDER_SCRIPT="${SCRIPT_DIR}/../storage-providers/${STORAGE_PROVIDER}.sh"

if [[ ! -f "$PROVIDER_SCRIPT" ]]; then
    echo "ERROR: Unknown storage provider: ${STORAGE_PROVIDER}" >&2
    exit 1
fi

source "$PROVIDER_SCRIPT"

if [[ "${1:-}" == "--cleanup" ]]; then
    shift
    cleanup_remote "$@"
else
    upload_file "$@"
fi
