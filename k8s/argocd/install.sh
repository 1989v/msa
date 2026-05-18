#!/usr/bin/env bash
# Argo CD 설치 + commerce Application 등록 + UI ingress + OCIR pull secret.
# oci-bootstrap.sh 가 완료된 직후 VM 안에서 1회 실행.
#
# Usage:
#   OCIR_REGION=ap-seoul-1 \
#   OCIR_NAMESPACE=<tenancy-namespace> \
#   OCIR_USERNAME=<tenancy-namespace>/<oci-username> \
#   OCIR_TOKEN=<auth-token> \
#   ./install.sh <PUBLIC_IP> <LE_EMAIL> <GITHUB_REPO_URL> <DOMAIN>

set -euo pipefail

if [[ $# -lt 4 ]]; then
  cat <<EOF
Usage: $0 <PUBLIC_IP> <LE_EMAIL> <GITHUB_REPO_URL> <DOMAIN>
  PUBLIC_IP       : OCI VM public IPv4
  LE_EMAIL        : Let's Encrypt 등록 이메일
  GITHUB_REPO_URL : Argo CD 가 sync 할 Git repo (HTTPS 또는 SSH)
  DOMAIN          : 베이스 도메인 (예: 1989v.com)
                    → commerce.<DOMAIN> 과 argocd.<DOMAIN> 로 라우팅된다.
                    Cloudflare DNS 등에 A 레코드 (commerce, argocd) 가
                    PUBLIC_IP 로 미리 설정돼 있어야 한다.

환경변수 (OCIR pull secret 생성용):
  OCIR_REGION     : OCI region key (예: ap-seoul-1)
  OCIR_NAMESPACE  : Tenancy Object Storage namespace
  OCIR_USERNAME   : "\$NAMESPACE/\$USERNAME" 형식
                    federated user 면 "\$NAMESPACE/oracleidentitycloudservice/\$USERNAME"
  OCIR_TOKEN      : OCI User Settings → Auth Tokens 에서 발급
EOF
  exit 1
fi

PUBLIC_IP="$1"
LE_EMAIL="$2"
GITHUB_REPO_URL="$3"
DOMAIN="$4"

# OCIR 환경변수 검증
: "${OCIR_REGION:?Need OCIR_REGION (예: ap-seoul-1)}"
: "${OCIR_NAMESPACE:?Need OCIR_NAMESPACE (Tenancy Object Storage namespace)}"
: "${OCIR_USERNAME:?Need OCIR_USERNAME (\$NAMESPACE/\$USER 형식)}"
: "${OCIR_TOKEN:?Need OCIR_TOKEN (Auth Token)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }

#───────────────────────────────────────────────────────────────────────────────
# 1. commerce ns 의 OCIR pull secret 생성
#───────────────────────────────────────────────────────────────────────────────
log "OCIR ImagePullSecret 생성 (namespace: commerce)"
kubectl create namespace commerce --dry-run=client -o yaml | kubectl apply -f -

kubectl -n commerce create secret docker-registry ocir-pull-secret \
  --docker-server="${OCIR_REGION}.ocir.io" \
  --docker-username="${OCIR_USERNAME}" \
  --docker-password="${OCIR_TOKEN}" \
  --docker-email="${LE_EMAIL}" \
  --dry-run=client -o yaml | kubectl apply -f -
ok "ocir-pull-secret 등록"

# 기존 SA 에도 imagePullSecrets 를 붙여 둔다. 실제 앱 Pod 는 oci-arm
# overlay 의 Pod spec imagePullSecrets 로도 동일 secret 을 참조한다.
log "기존 ServiceAccount 에 imagePullSecrets 부착"
for sa in $(kubectl -n commerce get sa -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
  kubectl -n commerce patch serviceaccount "$sa" \
    --type merge \
    -p '{"imagePullSecrets":[{"name":"ocir-pull-secret"}]}' \
    >/dev/null
done
ok "SA imagePullSecrets 부착 (기존)"

# 옛 설치 스크립트는 신규 SA 추격용 CronJob 을 만들었지만, 현재는
# oci-arm overlay 가 각 Pod spec 에 imagePullSecrets 를 직접 주입한다.
# Docker Hub rate limit 으로 bitnami/kubectl pull 이 실패하는 잡음도 제거.
log "legacy sa-pullsecret-patcher 정리"
kubectl -n commerce delete cronjob sa-pullsecret-patcher --ignore-not-found >/dev/null
kubectl -n commerce delete job -l batch.kubernetes.io/cronjob-name=sa-pullsecret-patcher --ignore-not-found >/dev/null
kubectl -n commerce delete serviceaccount sa-pullsecret-patcher --ignore-not-found >/dev/null
kubectl -n commerce delete role sa-pullsecret-patcher --ignore-not-found >/dev/null
kubectl -n commerce delete rolebinding sa-pullsecret-patcher --ignore-not-found >/dev/null
ok "legacy sa-pullsecret-patcher 정리 완료"

#───────────────────────────────────────────────────────────────────────────────
# 2. Helm 차트 설치 — Argo CD
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
# 3. Application CRD 적용 — commerce 플랫폼 sync 시작
#───────────────────────────────────────────────────────────────────────────────
log "Application CRD 적용 (repo: $GITHUB_REPO_URL, domain: $DOMAIN)"
sed -e "s|__GITHUB_REPO_URL__|$GITHUB_REPO_URL|g" \
    -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__OCI_LE_EMAIL__|$LE_EMAIL|g" \
  "$SCRIPT_DIR/application.yaml" | kubectl apply -f -
ok "Application 등록"

#───────────────────────────────────────────────────────────────────────────────
# 4. UI Ingress — argocd.<DOMAIN> + cert-manager TLS
#───────────────────────────────────────────────────────────────────────────────
log "UI Ingress 적용 (host: argocd.${DOMAIN})"
sed -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__OCI_LE_EMAIL__|$LE_EMAIL|g" \
    "$SCRIPT_DIR/ingress.yaml.template" | kubectl apply -f -
ok "Ingress 적용"

#───────────────────────────────────────────────────────────────────────────────
# 5. cert 발급 대기 (최대 5분)
#───────────────────────────────────────────────────────────────────────────────
log "TLS 인증서 발급 대기..."
kubectl -n argocd wait --for=condition=Ready \
  certificate/argocd-tls --timeout=300s 2>/dev/null \
  || echo "  (Ready 시점은 cert-manager describe 로 확인)"

#───────────────────────────────────────────────────────────────────────────────
# 6. 초기 admin 비번 출력
#───────────────────────────────────────────────────────────────────────────────
PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d 2>/dev/null || echo "<not-found>")

cat <<EOF

╭─────────────────────────────────────────────────────────────────╮
│  ✅ Argo CD 설치 완료                                            │
├─────────────────────────────────────────────────────────────────┤
│  UI URL    : https://argocd.${DOMAIN}
│  Username  : admin
│  Password  : ${PASSWORD}
│  Repository: ${GITHUB_REPO_URL}
│  OCIR      : ${OCIR_REGION}.ocir.io/${OCIR_NAMESPACE}
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

OCIR pull 실패 시:
     kubectl -n commerce describe pod <pod> | grep -A5 Events
     # → ImagePullBackOff / 401 unauthorized 면 ocir-pull-secret 재발급
     kubectl -n commerce delete secret ocir-pull-secret
     kubectl -n commerce create secret docker-registry ocir-pull-secret \\
       --docker-server="${OCIR_REGION}.ocir.io" \\
       --docker-username="${OCIR_USERNAME}" \\
       --docker-password='<new-auth-token>' \\
       --docker-email="${LE_EMAIL}"

EOF
