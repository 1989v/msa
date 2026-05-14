# oci-arm Overlay — Oracle Cloud Ampere A1 (Always Free)

Single-node k3s 배포용 overlay. 베이스는 `k3s-lite` 이고 그 위에 nip.io 호스트
라우팅 + cert-manager 기반 Let's Encrypt TLS 를 얹는다. 도메인이 없어도 신뢰
가능한 HTTPS 가 가능하다.

## 사전 요구사항 (OCI VM 안에서)

| 항목 | 비고 |
|---|---|
| VM | VM.Standard.A1.Flex / 4 OCPU / 24GB / arm64 (Always Free) |
| OS | Ubuntu 22.04 LTS arm64 권장 (Oracle Linux 도 가능) |
| 방화벽 | OCI VCN Security List + 호스트 iptables 80/443/6443 open |
| k3s | 단일 노드 설치 (`curl -sfL https://get.k3s.io \| sh -`) |
| ingress-nginx | helm install (`--set controller.service.type=LoadBalancer`) |
| cert-manager | helm install (CRDs 포함, `--set installCRDs=true`) |

자세한 부트스트랩 스크립트는 `scripts/oci-bootstrap.sh` (Phase C) 참조.

## 이미지 사전 작업 (arm64)

JVM 서비스 — Jib 는 빌드 호스트 아키텍처 따라가므로:

- **Apple Silicon Mac** : 그대로 `./gradlew jibBuildTar` → arm64 이미지 ✅
- **Intel Mac / x86 Linux** : `build.gradle.kts` 의 jib 설정에
  `to.platforms = ["linux/arm64"]` 추가 필요

FE 5종 (`portal-fe`, `admin-fe`, `quant-fe`, `gifticon-fe`, `agent-viewer-fe`):

```bash
# scripts/image-import.sh --fe 가 buildx 사용. arm64 호스트면 그대로 OK.
# x86 호스트면 docker buildx build --platform linux/arm64 명시 필요.
```

이미지 전송:

```bash
# 옵션 1: 로컬에서 빌드 → tar 로 OCI VM 복사 → k3s import
./gradlew jibBuildTar
scp */build/jib-image.tar opc@<OCI_IP>:~/images/
ssh opc@<OCI_IP> "for t in ~/images/*.tar; do sudo k3s ctr images import \$t; done"

# 옵션 2: 외부 레지스트리 (OCIR / Docker Hub) push → k3s 가 pull
```

## 적용 절차

### 1) Render & apply

```bash
# 인자: <PUBLIC_IP> <LE_EMAIL>
./k8s/overlays/oci-arm/scripts/render.sh 132.226.10.55 me@example.com \
  | kubectl apply -f -
```

내부적으로 `kubectl kustomize` 가 빌드한 매니페스트의
`__OCI_IP_DASHED__` 와 `__OCI_LE_EMAIL__` 를 sed 로 치환해서 출력한다.

### 2) cert 발급 확인

```bash
# ClusterIssuer 가 Ready 인지
kubectl get clusterissuer

# 인증서 발급 진행 상황 (HTTP01 챌린지 → Certificate Ready 까지 30s~2m)
kubectl -n commerce describe certificate gateway-nipio-tls
kubectl -n commerce describe certificate frontend-nipio-tls

# 발급된 secret 확인
kubectl -n commerce get secret | grep nipio-tls
```

### 3) 접속

```
https://commerce.132-226-10-55.nip.io/             → portal-fe (root)
https://commerce.132-226-10-55.nip.io/admin/       → admin-fe
https://commerce.132-226-10-55.nip.io/quant/       → quant-fe
https://commerce.132-226-10-55.nip.io/gifticon/    → gifticon-fe
https://commerce.132-226-10-55.nip.io/agent-viewer/→ agent-viewer-fe
https://commerce.132-226-10-55.nip.io/api/v1/...   → gateway REST
https://commerce.132-226-10-55.nip.io/sse/...      → gateway SSE
https://commerce.132-226-10-55.nip.io/ws/...       → gateway WebSocket
```

## 리소스 예산 (24GB / 4 OCPU)

| 그룹 | 메모리 한도 합 |
|---|---|
| 인프라 (MySQL/Redis/Kafka/ES/ClickHouse/quant-postgres) | ~7GB |
| 백엔드 서비스 16종 (k3s-lite 기준 768MB 제한, 일부 1GB) | ~13GB |
| FE 5종 (nginx) | ~250MB |
| k3s + ingress-nginx + cert-manager + 시스템 | ~3GB |
| **요청량 (실제 idle)** | **~15GB** |
| **한도 합** (스파이크 시 상한) | **~23GB** |

CPU 4 OCPU: cold start 시 1~2분간 high CPU (모든 JVM warmup 동시 발생).
이후 idle 은 1 OCPU 이하. 운영용이 아닌 데모/포트폴리오 용도라 수용 가능.

부족하면 우선 제거 후보:
- `analytics`, `experiment` (Kafka Streams + ClickHouse 부담)
- `chatbot`, `warehouse`, `fulfillment`, `inventory` (보조 서비스)

각 서비스를 빼려면 base 의 해당 deployment 를 kustomize patch 로
`replicas: 0` 으로 깎거나, kustomization 에서 제외하는 패치 추가.

## 트러블슈팅

### cert-manager 가 발급 못함

- ingress-nginx 가 80 포트 LoadBalancer 로 떠 있는지 확인
- 호스트의 80/443 이 OCI VCN Security List + iptables 양쪽 모두 열렸는지
- `kubectl -n cert-manager logs deploy/cert-manager` 에서 challenge 실패 사유 확인
- DNS: `dig commerce.<IP-DASHED>.nip.io` 가 정확한 IP 반환하는지
- 빠른 디버깅: staging issuer 로 먼저 발급 시도
  (`cert-manager.io/cluster-issuer: "letsencrypt-staging"` 으로 패치)

### Pod 가 ImagePullBackOff

- `k3s ctr images ls | grep commerce` 로 import 됐는지 확인
- 이미지 아키텍처: `k3s ctr images inspect <image>` 의 `Architecture: arm64` 확인
- 잘못 import 했다면: `sudo k3s ctr images rm <image>` 후 재 import

### OOMKilled 빈발

- `kubectl -n commerce top pods` 로 메모리 사용량 확인
- 특정 서비스가 한도 초과면 그 서비스의 resource limit 패치 추가
- 전체적으로 부족하면 비필수 서비스 제거 (위의 후보 참조)
