#!/usr/bin/env bash
# Argo CD 설치 + commerce Application 등록 + UI ingress 노출.
# oci-bootstrap.sh 가 완료된 직후 VM 안에서 1회 실행.
#
# Usage:
#   ./install.sh <PUBLIC_IP> <LE_EMAIL> <GITHUB_REPO_URL>
#
# Example:
#   ./install.sh 132.226.10.55 me@example.com https://github.com/kgd/msa.git

set -euo pipefail

if [[ $# -lt 3 ]]; then
  cat <<EOF
Usage: $0 <PUBLIC_IP> <LE_EMAIL> <GITHUB_REPO_URL>
  PUBLIC_IP       : OCI VM public IPv4
  LE_EMAIL        : Let's Encrypt 등록 이메일
  GITHUB_REPO_URL : Argo CD 가 sync 할 Git repo (HTTPS 또는 SSH)
EOF
  exit 1
fi

PUBLIC_IP="$1"
LE_EMAIL="$2"
GITHUB_REPO_URL="$3"
IP_DASHED="${PUBLIC_IP//./-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }

#───────────────────────────────────────────────────────────────────────────────
# 1. Helm 차트 설치
#───────────────────────────────────────────────────────────────────────────────
log "Argo CD Helm 차트 설치"
helm repo add argo https://argoproj.github.io/argo-helm 2>/dev/null || true
helm repo update

helm upgrade --install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --values "$SCRIPT_DIR/values.yaml" \
  --wait --timeout=10m

ok "Helm 설치 완료"

#───────────────────────────────────────────────────────────────────────────────
# 2. Application CRD 적용 — commerce 플랫폼 sync 시작
#───────────────────────────────────────────────────────────────────────────────
log "Application CRD 적용 (repo: $GITHUB_REPO_URL)"
sed "s|__GITHUB_REPO_URL__|$GITHUB_REPO_URL|g" \
  "$SCRIPT_DIR/application.yaml" | kubectl apply -f -
ok "Application 등록"

#───────────────────────────────────────────────────────────────────────────────
# 3. UI Ingress — argocd.<IP-DASHED>.nip.io + cert-manager TLS
#───────────────────────────────────────────────────────────────────────────────
log "UI Ingress 적용 (host: argocd.${IP_DASHED}.nip.io)"
sed -e "s/__OCI_IP_DASHED__/$IP_DASHED/g" \
    -e "s/__OCI_LE_EMAIL__/$LE_EMAIL/g" \
    "$SCRIPT_DIR/ingress.yaml.template" | kubectl apply -f -
ok "Ingress 적용"

#───────────────────────────────────────────────────────────────────────────────
# 4. cert 발급 대기 (최대 5분)
#───────────────────────────────────────────────────────────────────────────────
log "TLS 인증서 발급 대기..."
kubectl -n argocd wait --for=condition=Ready \
  certificate/argocd-tls --timeout=300s 2>/dev/null \
  || echo "  (Ready 시점은 cert-manager describe 로 확인)"

#───────────────────────────────────────────────────────────────────────────────
# 5. 초기 admin 비번 출력
#───────────────────────────────────────────────────────────────────────────────
PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d 2>/dev/null || echo "<not-found>")

cat <<EOF

╭─────────────────────────────────────────────────────────────────╮
│  ✅ Argo CD 설치 완료                                            │
├─────────────────────────────────────────────────────────────────┤
│  UI URL    : https://argocd.${IP_DASHED}.nip.io
│  Username  : admin
│  Password  : ${PASSWORD}
│  Repository: ${GITHUB_REPO_URL}
╰─────────────────────────────────────────────────────────────────╯

다음 단계:

1) UI 접속 → admin 비밀번호 변경 (User Info → Update Password)
2) Application 동기화 상태 확인:
     kubectl -n argocd get applications
     watch -n 5 'kubectl -n commerce get pods | head -30'
3) 초기 비밀번호 secret 회수 (선택):
     kubectl -n argocd delete secret argocd-initial-admin-secret

리소스 점유 확인:
     kubectl -n argocd top pods

OOM 발생 시 values.yaml 의 server/repoServer/controller 의 limits 를
한 단계씩 올린 뒤 helm upgrade 로 재적용.

EOF
