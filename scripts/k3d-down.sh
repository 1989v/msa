#!/usr/bin/env bash
# k3d-down.sh — Commerce Platform 로컬 클러스터 정리
#
# Usage:
#   scripts/k3d-down.sh              # 클러스터 삭제 (PVC 포함 전체)
#   scripts/k3d-down.sh --keep-data  # 클러스터 삭제하되 PVC/볼륨 보존
set -euo pipefail

CLUSTER_NAME="commerce"
KEEP_DATA=false
[[ "${1:-}" == "--keep-data" ]] && KEEP_DATA=true

echo "▸ Deleting k3d cluster '$CLUSTER_NAME'..."
k3d cluster delete "$CLUSTER_NAME" 2>/dev/null || echo "  (cluster not found)"

if [[ "$KEEP_DATA" == false ]]; then
    echo "▸ Pruning dangling Docker volumes from k3d..."
    docker volume prune -f 2>/dev/null | tail -1 || true
fi

echo "▸ Done."
echo "  다시 기동: scripts/k3d-up.sh"
