#!/usr/bin/env bash
# docker/docker-down.sh
# Docker Compose shutdown with automatic backup.
#
# Usage:
#   ./docker/docker-down.sh          # backup + down
#   ./docker/docker-down.sh --skip   # skip backup, just down
#   ./docker/docker-down.sh --only   # backup only, don't stop containers

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPTS="${SCRIPT_DIR}/backup/scripts"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SKIP_BACKUP=false
BACKUP_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --skip)  SKIP_BACKUP=true ;;
        --only)  BACKUP_ONLY=true ;;
        -h|--help)
            echo "Usage: docker-down.sh [--skip|--only]"
            echo "  (default)  Backup then docker compose down"
            echo "  --skip     Skip backup, just stop containers"
            echo "  --only     Run backup only, don't stop containers"
            exit 0
            ;;
    esac
done

run_backup() {
    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║       Pre-Shutdown Backup Starting       ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""

    local BACKUP_FAILED=false

    # 1. MySQL dump
    if [[ -x "${BACKUP_SCRIPTS}/backup-local-dump.sh" ]]; then
        echo "▸ MySQL backup..."
        if "${BACKUP_SCRIPTS}/backup-local-dump.sh"; then
            echo ""
        else
            echo "⚠ MySQL backup had failures (continuing)"
            BACKUP_FAILED=true
        fi
    else
        echo "⚠ backup-local-dump.sh not found, skipping MySQL"
    fi

    # 2. OpenSearch backup
    if [[ -x "${BACKUP_SCRIPTS}/backup-opensearch.sh" ]]; then
        echo "▸ OpenSearch backup..."
        if "${BACKUP_SCRIPTS}/backup-opensearch.sh"; then
            echo ""
        else
            echo "⚠ OpenSearch backup had failures (continuing)"
            BACKUP_FAILED=true
        fi
    else
        echo "⚠ backup-opensearch.sh not found, skipping OpenSearch"
    fi

    if [[ "$BACKUP_FAILED" == "true" ]]; then
        echo "╔══════════════════════════════════════════╗"
        echo "║  Backup completed with warnings          ║"
        echo "╚══════════════════════════════════════════╝"
    else
        echo "╔══════════════════════════════════════════╗"
        echo "║  Backup completed successfully           ║"
        echo "╚══════════════════════════════════════════╝"
    fi
    echo ""
}

# Run backup unless skipped
if [[ "$SKIP_BACKUP" == "false" ]]; then
    run_backup
fi

# Stop containers unless backup-only mode
if [[ "$BACKUP_ONLY" == "false" ]]; then
    echo "▸ Stopping Docker containers..."
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" down
    echo "✓ All containers stopped."
fi
