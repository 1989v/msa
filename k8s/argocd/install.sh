#!/usr/bin/env bash
# Argo CD 설치 + commerce Application 등록 + UI ingress + OCIR pull secret.
# oci-bootstrap.sh 가 완료된 직후 VM 안에서 1회 실행.
#
# Usage:
#   OCIR_REGION=ap-seoul-1 \
#   OCIR_NAMESPACE=<tenancy-namespace> \
#   OCIR_USERNAME=<tenancy-namespace>/<oci-username> \
#   OCIR_TOKEN=<auth-token> \
#   ./install.sh <PUBLIC_IP> <LE_EMAIL> <GITHUB_REPO_URL>

set -euo pipefail

if [[ $# -lt 3 ]]; then
  cat <<EOF
Usage: $0 <PUBLIC_IP> <LE_EMAIL> <GITHUB_REPO_URL>
  PUBLIC_IP       : OCI VM public IPv4
  LE_EMAIL        : Let's Encrypt 등록 이메일
  GITHUB_REPO_URL : Argo CD 가 sync 할 Git repo (HTTPS 또는 SSH)

환경변수 (OCIR pull secret 생성용 — commerce ns 의 모든 SA 에 자동 부착):
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
IP_DASHED="${PUBLIC_IP//./-}"

# OCIR 환경변수 검증
: "${OCIR_REGION:?Need OCIR_REGION (예: ap-seoul-1)}"
: "${OCIR_NAMESPACE:?Need OCIR_NAMESPACE (Tenancy Object Storage namespace)}"
: "${OCIR_USERNAME:?Need OCIR_USERNAME (\$NAMESPACE/\$USER 형식)}"
: "${OCIR_TOKEN:?Need OCIR_TOKEN (Auth Token)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }

#───────────────────────────────────────────────────────────────────────────────
# 1. commerce ns 의 OCIR pull secret + 전 SA 자동 부착
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

# 기존 SA 가 있으면 imagePullSecrets 패치, 없으면 다음에 ArgoCD 가 SA 만든 직후 후처리 잡으로 처리됨
log "기존 ServiceAccount 에 imagePullSecrets 부착"
for sa in $(kubectl -n commerce get sa -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
  kubectl -n commerce patch serviceaccount "$sa" \
    --type merge \
    -p '{"imagePullSecrets":[{"name":"ocir-pull-secret"}]}' \
    >/dev/null
done
ok "SA imagePullSecrets 부착 (기존)"

# Argo CD 가 sync 하면서 새 SA 를 만들면 자동으로 patch — 후처리 CronJob 등록
log "신규 SA 자동 patch CronJob 등록"
kubectl apply -f - <<'YAML'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sa-pullsecret-patcher
  namespace: commerce
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: sa-pullsecret-patcher
  namespace: commerce
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts"]
    verbs: ["get", "list", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: sa-pullsecret-patcher
  namespace: commerce
subjects:
  - kind: ServiceAccount
    name: sa-pullsecret-patcher
    namespace: commerce
roleRef:
  kind: Role
  name: sa-pullsecret-patcher
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sa-pullsecret-patcher
  namespace: commerce
spec:
  schedule: "*/2 * * * *"   # 매 2분 — sync 직후 빠르게 따라잡기
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      ttlSecondsAfterFinished: 60
      template:
        spec:
          serviceAccountName: sa-pullsecret-patcher
          restartPolicy: OnFailure
          containers:
            - name: kubectl
              image: bitnami/kubectl:1.31
              command:
                - sh
                - -c
                - |
                  set -e
                  for sa in $(kubectl -n commerce get sa -o jsonpath='{.items[*].metadata.name}'); do
                    has=$(kubectl -n commerce get sa "$sa" -o jsonpath='{.imagePullSecrets[*].name}' 2>/dev/null || true)
                    if ! echo "$has" | tr ' ' '\n' | grep -qx "ocir-pull-secret"; then
                      kubectl -n commerce patch serviceaccount "$sa" \
                        --type merge \
                        -p '{"imagePullSecrets":[{"name":"ocir-pull-secret"}]}'
                    fi
                  done
YAML
ok "CronJob/sa-pullsecret-patcher 등록 (매 2분)"

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
log "Application CRD 적용 (repo: $GITHUB_REPO_URL)"
sed "s|__GITHUB_REPO_URL__|$GITHUB_REPO_URL|g" \
  "$SCRIPT_DIR/application.yaml" | kubectl apply -f -
ok "Application 등록"

#───────────────────────────────────────────────────────────────────────────────
# 4. UI Ingress — argocd.<IP-DASHED>.nip.io + cert-manager TLS
#───────────────────────────────────────────────────────────────────────────────
log "UI Ingress 적용 (host: argocd.${IP_DASHED}.nip.io)"
sed -e "s/__OCI_IP_DASHED__/$IP_DASHED/g" \
    -e "s/__OCI_LE_EMAIL__/$LE_EMAIL/g" \
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
│  UI URL    : https://argocd.${IP_DASHED}.nip.io
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
