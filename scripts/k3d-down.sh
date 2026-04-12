#!/usr/bin/env bash
# k3d-down.sh — Commerce Platform 로컬 클러스터 정리
#
# Usage:
#   scripts/k3d-down.sh              # MySQL 스냅샷 후 클러스터 삭제
#   scripts/k3d-down.sh --no-dump    # 스냅샷 없이 바로 삭제
#   scripts/k3d-down.sh --keep-data  # 클러스터 삭제하되 PVC/볼륨 보존
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="commerce"
KEEP_DATA=false
NO_DUMP=false

for arg in "$@"; do
    case "$arg" in
        --keep-data) KEEP_DATA=true ;;
        --no-dump)   NO_DUMP=true ;;
    esac
done

# ─── MySQL data snapshot before destroy ───────────────────
if [[ "$NO_DUMP" == false ]] && k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME}"; then
    echo "▸ Snapshotting MySQL data before cluster deletion..."
    "$SCRIPT_DIR/k3d-mysql-dump.sh" || echo "  (dump failed — continuing with delete)"
fi

# ─── Cluster delete ──────────────────────────────────────
echo "▸ Deleting k3d cluster '$CLUSTER_NAME'..."
k3d cluster delete "$CLUSTER_NAME" 2>/dev/null || echo "  (cluster not found)"

if [[ "$KEEP_DATA" == false ]]; then
    echo "▸ Pruning dangling Docker volumes from k3d..."
    docker volume prune -f 2>/dev/null | tail -1 || true
fi

echo "▸ Done."
echo "  다시 기동: scripts/k3d-up.sh"
echo "  (MySQL 데이터는 다음 기동 시 자동 복구됩니다)"
