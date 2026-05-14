#!/usr/bin/env bash
# Render oci-arm overlay with concrete public IP + Let's Encrypt email.
#
# Usage:
#   ./scripts/render.sh <PUBLIC_IP> <LE_EMAIL>
#
# Example:
#   ./scripts/render.sh 132.226.10.55 me@example.com | kubectl apply -f -
#
# IP-dashed 규약: nip.io 는 a-b-c-d.nip.io 형태로 dashed IP 를 정적 A 레코드로
# 풀어준다. 점/대시 모두 지원하지만 대시가 SNI 호스트네임에 더 안전.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <PUBLIC_IP> <LE_EMAIL>" >&2
  echo "  PUBLIC_IP: OCI VM 의 public IPv4" >&2
  echo "  LE_EMAIL : Let's Encrypt 등록 이메일 (만료 알림용)" >&2
  exit 1
fi

PUBLIC_IP="$1"
LE_EMAIL="$2"
IP_DASHED="${PUBLIC_IP//./-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

kubectl kustomize "${OVERLAY_DIR}" \
  | sed -e "s/__OCI_IP_DASHED__/${IP_DASHED}/g" \
        -e "s/__OCI_LE_EMAIL__/${LE_EMAIL}/g"
