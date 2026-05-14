#!/usr/bin/env bash
# OCI VM 부트스트랩 — Ampere A1 (arm64) Always Free 인스턴스를 commerce 플랫폼
# 단일 노드 K8s 호스트로 만든다.
#
# 단계:
#   1. 호스트 방화벽 80/443/6443 오픈 (Oracle Linux firewalld / Ubuntu iptables)
#   2. k3s 단일 노드 설치 (Traefik 비활성, ServiceLB 활성)
#   3. Helm 설치
#   4. ingress-nginx 설치 (LoadBalancer)
#   5. cert-manager 설치 (CRDs 포함)
#
# OCI VCN Security List 는 콘솔에서 별도 작업 필수 — 마지막 안내 참조.
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/<user>/<repo>/main/scripts/oci-bootstrap.sh | sudo bash
#   # 또는 VM 에 scp 후
#   chmod +x oci-bootstrap.sh && sudo ./oci-bootstrap.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "❌ root 권한 필요. sudo 로 실행하세요." >&2
  exit 1
fi

INGRESS_NGINX_VERSION="${INGRESS_NGINX_VERSION:-4.11.3}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.16.1}"
K3S_VERSION="${K3S_VERSION:-v1.31.4+k3s1}"

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

#───────────────────────────────────────────────────────────────────────────────
# 1. 호스트 방화벽 — 80/443/6443 오픈
#───────────────────────────────────────────────────────────────────────────────
log "방화벽 설정 (80/443/6443)"

if command -v firewall-cmd &>/dev/null; then
  # Oracle Linux / RHEL — firewalld
  firewall-cmd --permanent --add-port=80/tcp || true
  firewall-cmd --permanent --add-port=443/tcp || true
  firewall-cmd --permanent --add-port=6443/tcp || true
  firewall-cmd --permanent --add-masquerade || true
  firewall-cmd --reload
  ok "firewalld 80/443/6443 open + masquerade"
elif command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  # Ubuntu — ufw active
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 6443/tcp
  ok "ufw 80/443/6443 open"
else
  # Ubuntu — iptables 직접 (OCI 기본 Ubuntu 이미지)
  iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  iptables -I INPUT -p tcp --dport 443 -j ACCEPT
  iptables -I INPUT -p tcp --dport 6443 -j ACCEPT
  # k3s pod/service CIDR egress 허용 — 기본 10.42.0.0/16 (pods), 10.43.0.0/16 (services)
  iptables -I FORWARD -s 10.42.0.0/16 -j ACCEPT
  iptables -I FORWARD -d 10.42.0.0/16 -j ACCEPT
  # 저장 (Ubuntu)
  if command -v netfilter-persistent &>/dev/null; then
    netfilter-persistent save
  elif command -v iptables-save &>/dev/null; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
  fi
  ok "iptables 80/443/6443 open"
fi

#───────────────────────────────────────────────────────────────────────────────
# 2. k3s 설치
#───────────────────────────────────────────────────────────────────────────────
if command -v k3s &>/dev/null; then
  ok "k3s 이미 설치됨 — 스킵 ($(k3s --version | head -1))"
else
  log "k3s 설치 ($K3S_VERSION)"
  # --disable=traefik : 우리는 ingress-nginx 사용
  # --write-kubeconfig-mode=644 : non-root 도 kubectl 사용 가능
  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION="$K3S_VERSION" \
    INSTALL_K3S_EXEC="--disable=traefik --write-kubeconfig-mode=644" \
    sh -
  ok "k3s 설치 완료"
fi

# kubeconfig 환경변수
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 클러스터 Ready 대기
log "k3s API 서버 Ready 대기 (최대 60s)"
for i in {1..30}; do
  if kubectl get node &>/dev/null; then
    ok "API 서버 Ready"
    break
  fi
  sleep 2
done

#───────────────────────────────────────────────────────────────────────────────
# 3. Helm 설치
#───────────────────────────────────────────────────────────────────────────────
if command -v helm &>/dev/null; then
  ok "Helm 이미 설치됨 — 스킵 ($(helm version --short))"
else
  log "Helm 설치"
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  ok "Helm 설치 완료"
fi

#───────────────────────────────────────────────────────────────────────────────
# 4. ingress-nginx
#───────────────────────────────────────────────────────────────────────────────
log "ingress-nginx 설치 ($INGRESS_NGINX_VERSION)"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --version "$INGRESS_NGINX_VERSION" \
  --namespace ingress-nginx --create-namespace \
  --set controller.ingressClassResource.default=true \
  --set controller.service.type=LoadBalancer \
  --set controller.admissionWebhooks.enabled=false \
  --wait --timeout=5m

ok "ingress-nginx 설치 완료"

#───────────────────────────────────────────────────────────────────────────────
# 5. cert-manager
#───────────────────────────────────────────────────────────────────────────────
log "cert-manager 설치 ($CERT_MANAGER_VERSION)"
helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
helm repo update

helm upgrade --install cert-manager jetstack/cert-manager \
  --version "$CERT_MANAGER_VERSION" \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true \
  --wait --timeout=5m

ok "cert-manager 설치 완료"

#───────────────────────────────────────────────────────────────────────────────
# 6. 검증
#───────────────────────────────────────────────────────────────────────────────
log "설치 검증"
kubectl get nodes
echo
kubectl -n ingress-nginx get svc
echo
kubectl -n cert-manager get pods

PUBLIC_IP="$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip || echo "<UNKNOWN>")"

cat <<EOF

╭─────────────────────────────────────────────────────────────────╮
│  ✅ 부트스트랩 완료                                              │
├─────────────────────────────────────────────────────────────────┤
│  Public IP : ${PUBLIC_IP}
│  kubeconfig: /etc/rancher/k3s/k3s.yaml
│  ingress-nginx svc: kubectl -n ingress-nginx get svc
╰─────────────────────────────────────────────────────────────────╯

다음 단계:

1) OCI Console > VCN > Security List 에서 80/443 ingress 허용 확인.
   기본 Always Free VCN 은 22 만 열려있다. 다음 규칙 추가 필수:
     Source CIDR: 0.0.0.0/0,  Dest port: 80,  Protocol: TCP
     Source CIDR: 0.0.0.0/0,  Dest port: 443, Protocol: TCP
   (6443 은 외부 노출 불필요. kubectl 은 SSH 터널 또는 SSH config 사용.)

2) 이미지 import — 로컬에서 빌드한 Jib tar 를 VM 으로 옮긴 뒤:
     for t in ~/images/*.tar; do sudo k3s ctr images import \$t; done

3) commerce 매니페스트 적용 (이 호스트에서, msa 레포 클론 후):
     ./k8s/overlays/oci-arm/scripts/render.sh ${PUBLIC_IP} you@example.com \\
       | kubectl apply -f -

4) 인증서 발급 진행 확인:
     kubectl -n commerce describe certificate gateway-nipio-tls
     kubectl -n commerce describe certificate frontend-nipio-tls

5) 접속:
     https://commerce.${PUBLIC_IP//./-}.nip.io/

EOF
