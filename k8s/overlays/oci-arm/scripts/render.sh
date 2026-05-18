#!/usr/bin/env bash
# Render oci-arm overlay with concrete domain + Let's Encrypt email.
#
# Usage:
#   ./scripts/render.sh <DOMAIN> <LE_EMAIL>
#
# Example:
#   ./scripts/render.sh 1989v.com me@example.com | kubectl apply -f -
#
# Ingress 는 host 별 분리 — root (portal-fe), admin., quant., gft., agent. (FE 5종)
# + api. (gateway) + argocd. (UI). DNS A 레코드 7종이 OCI public IP 로 사전
# 설정돼 있어야 한다.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <DOMAIN> <LE_EMAIL>" >&2
  echo "  DOMAIN   : 베이스 도메인 (예: 1989v.com)" >&2
  echo "  LE_EMAIL : Let's Encrypt 등록 이메일 (만료 알림용)" >&2
  exit 1
fi

DOMAIN="$1"
LE_EMAIL="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

kubectl kustomize "${OVERLAY_DIR}" \
  | sed -e "s/__DOMAIN__/${DOMAIN}/g" \
        -e "s/__OCI_LE_EMAIL__/${LE_EMAIL}/g"
