# oci-arm Overlay — Oracle Cloud Ampere A1 (Always Free)

Single-node k3s 배포용 overlay. 베이스는 `k3s-lite` 이고 그 위에 커스텀 도메인
기반 host 라우팅 (FE 별 subdomain) + cert-manager 기반 Let's Encrypt TLS 를
얹는다. 7개 DNS A 레코드 (`@`, admin, quant, gft, agent, api, argocd) 가 OCI
public IP 로 설정돼 있으면 자동으로 cert 발급.

## 사전 요구사항 (OCI VM 안에서)

| 항목 | 비고 |
|---|---|
| VM | VM.Standard.A1.Flex / 4 OCPU / 24GB / arm64 (Always Free) |
| OS | Ubuntu 22.04 LTS arm64 권장 (Oracle Linux 도 가능) |
| 방화벽 | OCI VCN Security List + 호스트 iptables 80/443/6443 open |
| k3s | 단일 노드 설치 (`curl -sfL https://get.k3s.io \| sh -`) |
| ingress-nginx | helm install (`--set controller.service.type=LoadBalancer`) |
| cert-manager | helm install (CRDs 포함, `--set installCRDs=true`) |

자세한 부트스트랩 스크립트: [`scripts/oci-bootstrap.sh`](../../../scripts/oci-bootstrap.sh).
VM 안에서 `sudo ./scripts/oci-bootstrap.sh` 한 번이면 k3s + ingress-nginx + cert-manager 까지 자동 설치된다.

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

**권장 경로: Argo CD 가 자동 sync** — `k8s/argocd/install.sh` 가 Application CRD 의
`spec.source.kustomize.patches` 에 IP/email 을 주입해 매번 override.
이 overlay 의 매니페스트 안 placeholder 는 그대로 두고 git 에는 환경값 안 박힘.

### 1) Argo CD 경로 (권장)

`k8s/argocd/install.sh` 실행 → Application 등록 → 자동 sync. 상세는
`k8s/argocd/README.md` 참조.

### 1-A) Legacy fallback — `render.sh` (Argo CD 안 쓸 때만)

```bash
# 인자: <DOMAIN> <LE_EMAIL>
./k8s/overlays/oci-arm/scripts/render.sh 1989v.com me@example.com \
  | kubectl apply -f -
```

내부적으로 `kubectl kustomize` 가 빌드한 매니페스트의
`__DOMAIN__` 와 `__OCI_LE_EMAIL__` 를 sed 로 치환해서 출력한다.
검증용 / Argo CD 미사용 환경에서만 사용. 사전에 DNS A 레코드 7종 (root,
admin, quant, gft, agent, api, argocd → public IP) 가 등록돼 있어야 cert
발급된다.

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
https://<DOMAIN>/                   → portal-fe (root)
https://admin.<DOMAIN>/             → admin-fe
https://quant.<DOMAIN>/             → quant-fe
https://gft.<DOMAIN>/               → gifticon-fe
https://agent.<DOMAIN>/             → agent-viewer-fe
https://api.<DOMAIN>/api/v1/...     → gateway REST (직접 호출용)
https://api.<DOMAIN>/sse/...        → gateway SSE
https://api.<DOMAIN>/ws/...         → gateway WebSocket
```

각 FE subdomain 도 `/api`, `/ws`, `/sse`, `/actuator`, `/svc` 를 같은 host 의
gateway 로 proxy 한다 → FE 코드는 same-origin `/api/*` 호출 유지, CORS 불필요.

## 리소스 예산 (24GB / 4 OCPU) — 6 Tier 차등 배분

`patches/resources-*.yaml` 로 서비스별 메모리 한도를 다음과 같이 분배:

| Tier | Limit | 서비스 | 비고 |
|---|---|---|---|
| **XL** | 1.2Gi | analytics | Kafka Streams + RocksDB state store + ClickHouse client |
| **L** | 1Gi | code-dictionary (k3s-lite 베이스), quant | ES+Flyway+QueryDSL+Caffeine / Phase 3 실시간 트레이딩 |
| **M** | 768Mi | gateway, product, order, search, gifticon, fulfillment | 고트래픽 / Kafka producer / OOM 이력 |
| **S** | 512Mi | experiment, search-batch, search-consumer, recommendation, recommendation-ann, auth, chatbot | Kafka consumer + 경량 JPA |
| **XS** | 384Mi | member, wishlist, inventory, warehouse, agent-viewer-api | 최소 CRUD |
| **FE** | 96Mi | portal-fe, admin-fe, quant-fe, gifticon-fe, agent-viewer-fe | nginx static |

JVM heap 보정: `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=60.0` 전 백엔드 주입 →
512Mi 컨테이너 = ~300Mi heap, 384Mi 컨테이너 = ~230Mi heap. nginx 는 변수 무시.

**총 한도 합산:**

| 그룹 | 메모리 한도 합 |
|---|---|
| 백엔드 21종 (XL/L/M/S/XS 차등) | ~13.0 Gi |
| FE 5종 (96Mi) | ~0.5 Gi |
| 인프라 (MySQL/Redis/Kafka/ES/ClickHouse/Postgres) | ~6.75 Gi |
| k3s + ingress-nginx + cert-manager + 시스템 | ~2.3 Gi |
| **합계** | **~22.6 Gi** ✓ (24Gi 안에 ~1.4Gi 여유) |

CPU 4 OCPU: cold start 시 1~2분간 high CPU (모든 JVM warmup 동시 발생).
이후 idle 은 1 OCPU 이하. 운영용이 아닌 데모/포트폴리오 용도라 수용 가능.

특정 서비스가 OOM 나면 해당 tier 패치만 수정 (예: chatbot 이 부족하면
S(512) → M(768) 로 승격). 글로벌 default 는 건드리지 말 것.

## 트러블슈팅

### cert-manager 가 발급 못함

- ingress-nginx 가 80 포트 LoadBalancer 로 떠 있는지 확인
- 호스트의 80/443 이 OCI VCN Security List + iptables 양쪽 모두 열렸는지
- `kubectl -n cert-manager logs deploy/cert-manager` 에서 challenge 실패 사유 확인
- DNS: `dig <DOMAIN> admin.<DOMAIN> api.<DOMAIN>` 등이 OCI public IP 반환하는지
  (Cloudflare proxy off, gray cloud 상태인지)
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
