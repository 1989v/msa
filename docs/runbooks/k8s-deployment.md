# K8s / k3s Deployment Runbook

Commerce Platform을 Kubernetes에 배포하는 표준 절차. 두 가지 배포 모드를
지원하며 동일한 `k8s/base/` 매니페스트를 공유한다.

| Mode | 용도 | Overlay | Infra |
|------|------|---------|-------|
| **k3s-lite** | 로컬 k3d / 에지 단일 노드 | `k8s/overlays/k3s-lite/` | `k8s/infra/local/` (plain StatefulSet) |
| **prod-k8s** | EKS / GKE / AKS 같은 managed K8s | `k8s/overlays/prod-k8s/` | `k8s/infra/prod/` (Operator 기반) |

전환 이력과 설계 결정은 [ADR-0019](../adr/ADR-0019-k8s-migration.md),
아키텍처 개요는 [k8s-deployment-model.md](../architecture/k8s-deployment-model.md)
참조.

---

## 0. 공통 전제

### 0.1 필수 도구

| 도구 | 버전 | 설치 |
|------|------|------|
| `kubectl` | 1.29+ | `brew install kubectl` |
| `kustomize` | 내장 (kubectl 1.14+) | — |
| `helm` | 3.x | `brew install helm` |
| `java` | JDK 25 (toolchain) | Gradle이 자동 관리 |
| **k3s-lite 전용** `k3d` | 5.x | `brew install k3d` |
| **k3s-lite 전용** Docker | Desktop / Colima / Rancher | k3d가 Docker 위에서 구동 |
| **prod-k8s 전용** 클러스터 접근 | `kubectl config` | 클라우드별 설정 |

### 0.2 이미지 빌드 (공통)

모든 JVM 서비스는 [Jib](https://github.com/GoogleContainerTools/jib) convention
(`buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts`)으로 빌드된다.
Dockerfile이나 Docker 데몬은 **이미지 빌드 자체**엔 필요 없다. 다만 k3d/kind
같은 로컬 클러스터가 Docker 런타임 위에서 돌기 때문에 로컬에선 여전히 Docker
Desktop이 살아 있어야 한다.

공통 빌드 명령:

```bash
# 전체 JVM 서비스 tar 생성 (로컬 import 용)
./gradlew jibBuildTar

# 개별 서비스만
./gradlew :gateway:jibBuildTar
./gradlew :product:app:jibBuildTar

# 레지스트리에 직접 push (prod 용)
./gradlew jib -PjibRegistry=ghcr.io/1989v
./gradlew jib -PjibRegistry=ghcr.io/1989v -PjibTag=$(git rev-parse --short HEAD)
```

`-PjibRegistry`를 안 주면 기본값 `commerce/<svc>`로 빌드되어 로컬 import
시나리오에만 유효하다. CI는 `.github/workflows/images.yml`이 자동으로
`ghcr.io/<owner>` + commit SHA 태그로 push한다.

---

## 1. Mode A — k3s-lite (로컬 단일 노드)

대상: 개발자 노트북의 k3d 클러스터, 에지 단일 서버의 k3s. RAM 최소 8 GiB,
권장 12 GiB 이상. 18개 JVM 서비스를 **동시에** Ready로 유지하려면 10 GiB 넘게
먹을 수 있다.

### 1.1 클러스터 생성 (k3d)

```bash
k3d cluster create commerce \
    --k3s-arg "--disable=traefik@server:*" \
    --port "80:80@loadbalancer" \
    --port "443:443@loadbalancer" \
    --agents 0
```

- `--disable=traefik`: ingress-nginx를 쓰기 위해 k3s 기본 Traefik을 끈다.
- `-p 80:80`, `-p 443:443`: 호스트 포트를 k3d LoadBalancer에 바인딩해서
  `curl http://localhost/...`로 접근 가능하게 한다.
- `--agents 0`: 단일 노드 구성 (server만).

확인:

```bash
kubectl config current-context   # k3d-commerce
kubectl get nodes                # 1 Ready
```

### 1.2 ingress-nginx 설치 (한 번만)

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false
```

`admissionWebhooks=false`는 cert-manager 의존을 피하기 위한 로컬 simplification.
prod에선 Phase 4의 cert-manager를 먼저 올린 뒤 webhook을 다시 활성화한다.

확인:

```bash
kubectl -n ingress-nginx get pods     # controller 1/1 Ready
kubectl get ingressclass              # nginx (default)
```

### 1.3 이미지 빌드 + 주입

```bash
# 1) Jib tar 18개 생성 (~1 분)
./gradlew jibBuildTar

# 2) k3d 노드로 import
scripts/image-import.sh --all
```

`scripts/image-import.sh`는 현재 `kubectl config current-context`를 감지해서
`k3d-*`면 `k3d image import`, `kind-*`면 `kind load image-archive`로 dispatch
한다. 순수 k3s 환경에선 `/var/lib/rancher/k3s/agent/images/`에 tar를 드롭하는
경로가 별도로 필요하다 (스크립트에 안내 포함).

확인:

```bash
docker exec k3d-commerce-server-0 crictl images | grep commerce | wc -l
# 36 (18 서비스 × latest/<version> 태그)
```

### 1.4 인프라 + 앱 한 번에 apply

```bash
kubectl apply -k k8s/overlays/k3s-lite
```

이 한 줄이:

- `commerce` 네임스페이스
- `k8s/infra/local/`: MySQL (단일 파드 + 17개 Service 별칭), Redis, Kafka
  (KRaft 단일 노드), Elasticsearch, OpenSearch, ClickHouse
- `k8s/base/` 18개 Spring Boot app (Deployment + Service + SA) + gateway Ingress
- `k8s/overlays/k3s-lite/patches/`: 리소스 감축, Redis cluster→standalone
  오버라이드, Hibernate `ddl-auto=update`, startup probe 추가

를 전부 적용한다.

### 1.5 기동 대기 및 검증

```bash
# 모든 app pod Ready 대기 (5~10 분)
kubectl -n commerce wait --for=condition=Ready pods \
    -l app.kubernetes.io/part-of=commerce-platform \
    --timeout=600s

# 상태 확인
kubectl -n commerce get pods
```

인프라는 1~2분 안에 Ready, Spring Boot 앱은 Jib 이미지 레이어 로드 + Hibernate
schema update 때문에 초기 실행은 60~90초가 걸린다. `startupProbe` 덕분에
liveness 킬은 발생하지 않는다.

엔드포인트 스모크:

```bash
# Gateway health (Ingress 경유)
curl -s http://localhost/actuator/health/liveness
# {"components":{"livenessState":{"status":"UP"}},"status":"UP"}

# Gateway route (미인증 → 401 — auth filter 정상 동작 증거)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/products
# 401
```

### 1.6 비핵심 서비스 스케일다운 (RAM 부족 시)

18개 앱 전부 Ready는 단일 노드에서 빠듯할 수 있다. 개발 중에는 필요한
서비스만 남기고 나머지는 `replicas=0`으로 내려둔다.

```bash
for svc in chatbot analytics experiment code-dictionary \
           search-batch search-consumer agent-viewer-api \
           inventory fulfillment warehouse member \
           wishlist gifticon; do
  kubectl -n commerce scale deployment/$svc --replicas=0
done
```

되살리려면 `--replicas=1`.

### 1.7 이미지 갱신 (코드 수정 후)

```bash
./gradlew :product:app:jibBuildTar                # 1분
scripts/image-import.sh --service product         # 수 초
kubectl -n commerce rollout restart deploy/product
```

### 1.8 클러스터 정리

```bash
# 앱만 제거 (인프라 유지)
kubectl delete -k k8s/overlays/k3s-lite

# PVC까지 전부 초기화
kubectl -n commerce delete pvc --all

# 클러스터 통째로 삭제
k3d cluster delete commerce
```

---

## 2. Mode B — prod-k8s (managed Kubernetes)

대상: EKS / GKE / AKS 같은 managed K8s 클러스터. 3 노드 이상, 노드당 4 CPU /
16 GiB 권장. k3s-lite와 달리 인프라는 **Operator 기반**으로 운영된다.

### 2.1 사전 설치 (cluster-wide, 한 번만)

순서가 중요하다. 오퍼레이터 CRD가 먼저 들어가고 그 뒤에 CR을 apply한다.

```bash
# 1) ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.service.type=LoadBalancer \
    --set controller.ingressClassResource.default=true

# 2) cert-manager (TLS 발급)
kubectl apply -f \
    https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl apply -f k8s/infra/prod/cert-manager/cluster-issuer.yaml
# → cluster-issuer.yaml의 email은 미리 실제 값으로 수정

# 3) Sealed Secrets (Secret 봉인)
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
    --namespace kube-system

# 4) 모니터링 (Prometheus + Grafana)
helm repo add prometheus-community \
    https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack \
    prometheus-community/kube-prometheus-stack \
    --namespace monitoring --create-namespace \
    --values k8s/infra/prod/monitoring/values.yaml

# 5) 데이터 플레인 오퍼레이터
#    Strimzi (Kafka)
helm repo add strimzi https://strimzi.io/charts
helm upgrade --install strimzi strimzi/strimzi-kafka-operator \
    --namespace kafka --create-namespace --set watchAnyNamespace=true

#    Percona MySQL
kubectl apply -f \
    https://raw.githubusercontent.com/percona/percona-server-mysql-operator/main/deploy/bundle.yaml

#    ECK (Elasticsearch)
kubectl apply -f https://download.elastic.co/downloads/eck/2.15.0/crds.yaml
kubectl apply -f https://download.elastic.co/downloads/eck/2.15.0/operator.yaml

#    OpenSearch Operator
helm repo add opensearch-operator \
    https://opensearch-project.github.io/opensearch-k8s-operator/
helm upgrade --install opensearch-operator \
    opensearch-operator/opensearch-operator \
    --namespace opensearch-operator-system --create-namespace

#    Altinity ClickHouse
kubectl apply -f \
    https://raw.githubusercontent.com/Altinity/clickhouse-operator/master/deploy/operator/clickhouse-operator-install-bundle.yaml
```

각 오퍼레이터의 READY 상태 확인 후 다음 단계로 넘어간다:

```bash
kubectl -n kafka get pods -l name=strimzi-cluster-operator
kubectl -n cert-manager get pods
kubectl -n monitoring get pods
# ... 모두 Running
```

### 2.2 인프라 CR apply

Operator가 감시하는 CR들을 한 번에 적용:

```bash
# Kafka 클러스터 + 토픽
kubectl apply -f k8s/infra/prod/strimzi/kafka-cluster.yaml
kubectl apply -f k8s/infra/prod/strimzi/kafka-topics.yaml

# MySQL (단일 클러스터 + 서비스별 Service 별칭)
kubectl apply -f k8s/infra/prod/percona-mysql/mysql-clusters.yaml

# Elasticsearch
kubectl apply -f k8s/infra/prod/eck/elasticsearch.yaml

# OpenSearch
kubectl apply -f k8s/infra/prod/opensearch/opensearch-cluster.yaml

# ClickHouse
kubectl apply -f k8s/infra/prod/clickhouse/clickhouse-installation.yaml

# Redis Cluster (Helm)
helm upgrade --install redis bitnami/redis-cluster \
    --namespace commerce \
    --values k8s/infra/prod/redis/values.yaml
```

Strimzi Kafka의 경우 클러스터가 `Ready`가 될 때까지 3~5분 소요:

```bash
kubectl -n commerce wait kafka/commerce \
    --for=condition=Ready --timeout=10m
```

### 2.3 MySQL 데이터베이스 초기화 (최초 1회)

Percona 오퍼레이터는 데이터베이스 스키마/사용자를 만들지 않는다. Job으로
수동 초기화:

```bash
kubectl apply -f k8s/infra/prod/percona-mysql/init-databases-job.yaml
kubectl -n commerce wait job/mysql-init-databases \
    --for=condition=Complete --timeout=5m
```

이 Job은 12개 서비스 DB + 사용자 (product_db / product_user 등)를 만든다.
실제 패스워드는 Sealed Secret으로 사전에 주입해야 한다
([`k8s/infra/prod/sealed-secrets/README.md`](../../k8s/infra/prod/sealed-secrets/README.md)
참조).

### 2.4 백업 CronJob 배포

Phase 5 백업 러너는 `docker/backup/scripts/`의 기존 XtraBackup 로직을 이미지로
래핑한 것이다.

```bash
# 1) 백업 러너 이미지 빌드 + push (한 번만, 코드 변경 시 재빌드)
docker build -f k8s/infra/prod/backup/Dockerfile \
    -t ghcr.io/1989v/backup-runner:latest .
docker push ghcr.io/1989v/backup-runner:latest

# 2) CronJob + ConfigMap + Secret + PVC
kubectl apply -k k8s/infra/prod/backup

# 수동 스모크 테스트
kubectl -n commerce create job backup-full-smoke \
    --from=cronjob/backup-full
kubectl -n commerce logs job/backup-full-smoke -f
```

### 2.5 앱 이미지 빌드 + push

로컬에서 직접 push:

```bash
./gradlew jib \
    -PjibRegistry=ghcr.io/1989v \
    -PjibTag=$(git rev-parse --short HEAD)
```

또는 main 브랜치 push만 하면 `.github/workflows/images.yml`이 자동으로 같은
일을 한다. 이 경로가 권장된다.

### 2.6 overlay apply

```bash
# 사전 체크: 변경 사항 diff
kubectl kustomize k8s/overlays/prod-k8s | kubectl diff -f -

# 실제 적용
kubectl apply -k k8s/overlays/prod-k8s
```

overlay는:

- 각 Deployment를 `replicas: 2`로 패치
- Resource `requests: 200m/1Gi`, `limits: 2 CPU/2 GiB`
- 16개 HorizontalPodAutoscaler (`search-batch`, `agent-viewer-api` 제외)
- 16개 PodDisruptionBudget (`minAvailable: 1`)
- Gateway Ingress TLS + cert-manager annotation (`letsencrypt-prod`)

를 base 위에 덮어쓴다. prod에서 쓰기 전에
[`k8s/overlays/prod-k8s/README.md`](../../k8s/overlays/prod-k8s/README.md)의
**커스터마이즈 체크리스트**를 반드시 확인 (도메인, Secret, replica 수,
resource limit).

### 2.7 기동 대기 및 검증

```bash
kubectl -n commerce rollout status deploy/gateway --timeout=5m
kubectl -n commerce get pods,hpa,pdb,ing
```

외부 접근 (HTTPS):

```bash
curl -s https://api.commerce.example.com/actuator/health/liveness
```

### 2.8 롤링 업데이트

CI가 새 이미지를 push하면:

```bash
# 배포된 overlay에서 이미지 태그 업데이트
kustomize edit set image \
    commerce/gateway=ghcr.io/1989v/gateway:$(git rev-parse --short HEAD)

# 또는 annotation으로 rollout 강제
kubectl -n commerce set image deploy/gateway \
    app=ghcr.io/1989v/gateway:$(git rev-parse --short HEAD)
```

실제 운영에선 GitOps (ArgoCD / Flux)로 자동화하는 것이 권장되지만, 본 phase의
스코프 밖이다.

### 2.9 재해 복구 / 수동 백업

```bash
# 수동 풀백업 트리거
kubectl -n commerce create job backup-now --from=cronjob/backup-full

# 복구는 Phase 5 README 참조
cat k8s/infra/prod/backup/README.md
```

---

## 3. 자주 쓰는 조회 명령 (공통)

```bash
# 모든 파드 상태 한 번에
kubectl -n commerce get pods,svc,ingress

# 특정 서비스 로그 follow
kubectl -n commerce logs deploy/gateway -f

# 모든 Deployment의 환경 변수 확인
kubectl -n commerce describe pod -l app.kubernetes.io/name=gateway | less

# 리소스 사용량
kubectl top nodes
kubectl top pods -n commerce

# 이벤트 (문제 진단 시)
kubectl -n commerce get events --sort-by=.lastTimestamp | tail -30
```

---

## 4. 트러블슈팅

### 4.1 pod CrashLoopBackOff

```bash
kubectl -n commerce logs <pod> --previous
kubectl -n commerce describe pod <pod>
```

자주 발생하는 원인:

- **DB 연결 실패**: MySQL pod이 아직 Ready가 아니면 Spring Boot가 실패.
  `kubectl -n commerce wait --for=condition=Ready pod/mysql-0`로 먼저 확인.
- **Kafka 연결 실패**: Kafka KRaft 포맷 중이면 client가 일시적으로 실패.
  재시작 몇 번 기다리면 안정화.
- **Jackson ObjectMapper 주입 실패**: Phase 7 이후의 commit이 적용됐는지
  확인. `common` 모듈에 `CommonJacksonAutoConfiguration`이 들어 있어야 한다.

### 4.2 Ingress 503 / 404

```bash
# 컨트롤러 상태
kubectl -n ingress-nginx get pods
kubectl -n ingress-nginx logs deploy/ingress-nginx-controller

# Ingress 리소스가 실제로 백엔드를 찾고 있는지
kubectl -n commerce describe ingress gateway
kubectl -n commerce get endpoints gateway
```

### 4.3 리소스 부족 (특히 k3s-lite)

```bash
kubectl top nodes
docker stats --no-stream k3d-commerce-server-0
```

노드 CPU > 80%, 메모리 > 85%면 비핵심 서비스를 `replicas=0`으로 내려
(1.6절 참조).

### 4.4 이미지가 k3d에 없음

```bash
docker exec k3d-commerce-server-0 crictl images | grep commerce
```

없으면 `scripts/image-import.sh --all` 다시 실행. `imagePullPolicy: IfNotPresent`
로 설정돼 있어서 로컬에 없으면 Docker Hub에서 pull을 시도하다 실패한다.

### 4.5 Redis 연결 실패 (`RedisClusterNotAvailableException`)

k3s-lite의 standalone Redis에서 Spring Data Redis **cluster 클라이언트**가
CLUSTER 커맨드를 시도해 실패하는 알려진 이슈. 해당 서비스는 overlay의
`SPRING_APPLICATION_JSON` 패치로 standalone 모드로 전환돼 있다 — 적용이
안 되어 있다면:

```bash
kubectl -n commerce describe pod gateway-xxx | grep SPRING_APPLICATION_JSON
```

없으면 `kubectl apply -k k8s/overlays/k3s-lite`를 다시 실행해 overlay
패치를 적용한다. 그래도 실패하면
[`k8s/overlays/k3s-lite/README.md`](../../k8s/overlays/k3s-lite/README.md)
의 fallback 절차(real 6-node cluster 교체)를 따른다.

---

## 5. OCI 외부 접근 — Cloudflare Zero Trust Tunnel

OCI Ampere A1 (oci-arm overlay) 에 떠있는 인프라(MySQL/Redis/Kafka/ES/ClickHouse/Postgres)
에 macOS DBeaver/DataGrip 등에서 안전하게 접속하기 위한 표준 셋업.

**핵심 원칙**: OCI inbound port 는 80/443 외 모두 닫고 (host-access prune됨),
Cloudflare Tunnel + WARP private hostname routing 으로 인증된 외부 접근만 허용.
**fallback flag (예: `--protocol=http2`) 또는 SSL 우회는 사용 금지** — 표준 default
동작(MASQUE/QUIC) 유지 + 환경(노드 sysctl) 정공법 fix.

### 5.1 아키텍처

```
DataGrip (macOS)
  → mysql.1989v.com:3306
  → WARP (Cloudflare One Client) 가 DNS 가로채서 100.80.x.x CGNAT 응답
  → 가상 IP 패킷을 Cloudflare 엣지로 라우팅 (MASQUE/QUIC)
  → Cloudflare Tunnel 통해 OCI cloudflared pod 로
  → cloudflared 가 mysql.1989v.com 을 origin 으로 resolve (CoreDNS rewrite)
  → mysql-product-master.commerce.svc.cluster.local:3306
```

**보안 게이트 3중**:
1. OCI VCN Security List 가 13306 등 inbound 차단 (host-access manifest 자체가 base 에서 제외됨)
2. Cloudflare Access policy `allow-me` 가 본인 이메일만 허용
3. Cloudflare Tunnel 이 outbound-only (OCI → Cloudflare 엣지)

### 5.2 사전 셋업 (1회, git 매니페스트로 관리)

다음 매니페스트가 `k8s/overlays/oci-arm/` 에 있고 git source of truth:

| 매니페스트 | 역할 | 적용 방식 |
|------------|------|-----------|
| `cloudflared/deployment.yaml` | Tunnel connector 2 replica (image **2026.5.0** — private hostname routing 안정 버전. 최소 2025.7.0+) | ArgoCD 자동 sync (commerce ns) |
| `cloudflared/network-policy.yaml` | (1) cloudflared egress 허용 (2) **cloudflared → 인프라 6종 ingress 허용** — base/network-policy 의 `allow-app-to-clickhouse` 등이 좁아서 cloudflared 매치 안 되는 갭 보강 | ArgoCD 자동 sync |
| `coredns-custom.yaml` | `mysql.1989v.com → mysql-product-master.commerce.svc.cluster.local` 등 6개 rewrite — cloudflared 가 origin 으로 resolve | **수동 apply** (kube-system ns) |
| `sysctl-tuning/daemonset.yaml` | 노드 `net.core.rmem_max=7.5MB` 적용 (QUIC 권장값) — fallback flag 안 쓰고 표준 MASQUE 동작 | **수동 apply** (kube-system ns) |
| `kustomization.yaml` (Kafka patch) | Kafka EXTERNAL listener advertised 를 `kafka.1989v.com:19092` 로, service 에 19092 port 추가 | ArgoCD 자동 sync |

수동 apply (OCI 인스턴스에서 1회):

```bash
curl -fsSL https://raw.githubusercontent.com/1989v/msa/main/k8s/overlays/oci-arm/coredns-custom.yaml \
  | sudo k3s kubectl apply -f -
curl -fsSL https://raw.githubusercontent.com/1989v/msa/main/k8s/overlays/oci-arm/sysctl-tuning/daemonset.yaml \
  | sudo k3s kubectl apply -f -
sudo k3s kubectl -n kube-system rollout restart deployment coredns
```

Tunnel 토큰 Secret (`cloudflared-tunnel-token`) 도 OCI 에서 1회 수동 등록
(git 미포함, `cf-origin-ca-tls` 와 동일 패턴):

```bash
read -s -r TOKEN   # Cloudflare dashboard 에서 발급한 eyJhIjoi... 토큰 붙여넣기
sudo k3s kubectl -n commerce create secret generic cloudflared-tunnel-token \
  --from-literal=token="$TOKEN"
unset TOKEN
```

### 5.3 Cloudflare dashboard 셋업 (1회)

#### 5.3.1 Tunnel 생성

**Zero Trust → 네트워크 → 커넥터 → 커넥터 만들기**
- Connector type: **Cloudflared**
- Tunnel name: `msa` (또는 환경별 — `msa-prod` / `msa-dev`)
- 토큰 발급 → 위 5.2 의 Secret 등록에 사용

#### 5.3.2 Hostname Route 등록 (인프라 갯수만큼)

**Zero Trust → 네트워크 → 경로 → 호스트 이름 경로 → 추가**

| Hostname | Tunnel | Virtual network |
|----------|--------|----------------|
| `mysql.1989v.com` | msa | default |
| `postgres.1989v.com` | msa | default |
| `redis.1989v.com` | msa | default |
| `kafka.1989v.com` | msa | default |
| `ch.1989v.com` | msa | default |
| `es.1989v.com` | msa | default |

> Service URL 필드 없음 — cloudflared 가 hostname 그대로 받아서 CoreDNS rewrite 로 cluster service 해석.

#### 5.3.3 Access 설정 (글로벌)

**Zero Trust → 액세스 제어 → Access 설정**

- **Cloudflare One Client 인증** 섹션:
  - "Cloudflare One Client 세션을 사용한 인증 사용" **켬**
  - "모든 애플리케이션에 대해 클라이언트 인증 활성화" **켬**
  - 세션 기간: `8 hours` (운영 정책에 맞게 8-24 hours)

#### 5.3.4 ID 공급자 + 디바이스 등록 권한

**Zero Trust → 통합 → ID 공급자**: **일회용 PIN (One-time PIN)** 추가

**Zero Trust → 디바이스 → 관리 → 정책 / 로그인 방법**:
- 정책: Include Emails = 본인 이메일
- 로그인 방법: 일회용 PIN

#### 5.3.5 Gateway Proxy

**Zero Trust → 트래픽 정책 → 트래픽 설정 → 프록시 및 검사**:
- Secure Web Gateway proxy: 켬
- TCP / UDP / ICMP: 모두 켬

#### 5.3.6 Access Application (인프라 갯수만큼)

**Zero Trust → 액세스 제어 → 응용 프로그램 → 응용 프로그램 추가 → 자체 호스팅 및 프라이빗 → 프라이빗 대상**

| 응용 프로그램 | 개인 호스트 이름 |
|------------|----------------|
| `mysql` | `mysql.1989v.com:3306` |
| `postgres` | `postgres.1989v.com:5432` |
| `redis` | `redis.1989v.com:6379` |
| `kafka` | `kafka.1989v.com:19092` |
| `ch` | `ch.1989v.com:8123` + `ch.1989v.com:9000` (한 응용 프로그램에 개인 호스트 이름 2개) |
| `es` | `es.1989v.com:9200` |

공통 설정:
- 정책: `allow-me` (Include Emails = 본인 이메일) — 처음 만들고 이후 응용 프로그램은 "현재 정책 추가" 로 재사용
- 인증: **Cloudflare One Client로 인증 켬**

#### 5.3.7 WARP Split Tunnel

**Zero Trust → 디바이스 → 디바이스 프로필 → 일반 프로필 → Configure → Split Tunnels**:
- Mode: **IP 및 도메인 포함** (Include mode)
- IP: `100.80.0.0/16` (Cloudflare CGNAT 가상 IP 대역)
- Host: `<team>.cloudflareaccess.com` (예: `1989v.cloudflareaccess.com`) — **인증 페이지도 WARP 라우팅 보장 필수**

### 5.4 클라이언트 셋업 (macOS, 사용자 1회)

```bash
brew install --cask cloudflare-warp
```

WARP 메뉴바 클릭 → **Cloudflare One Client** 모드 선택 → Team name 입력 (예: `1989v`)
→ 브라우저 IdP 인증 (일회용 PIN) → 통과.

### 5.5 검증

```bash
warp-cli connect
sleep 30
nslookup mysql.1989v.com   # Address 가 100.80.X.X 여야 정상

mysql -h mysql.1989v.com -P 3306 -u root -plocalroot \
  --ssl-mode=DISABLED --protocol=TCP -e "SELECT VERSION();"
```

DataGrip / DBeaver: `Host = <hostname>.1989v.com`, `Port = <port>`, Driver properties
에 `sslMode=DISABLED` + `allowPublicKeyRetrieval=true`. (dev 환경 한정 — prod 운영
시엔 mysql TLS 셋업 후 `sslMode=VERIFY_CA` 표준.)

#### Web UI 도구 (Kibana, Kafka UI) — 로컬 docker

WARP 가 켜져있고 macOS 가 cluster hostname 으로 접근 가능하면 그대로 connect:

```bash
# Kibana — Elasticsearch UI
docker run -d --name kibana --restart unless-stopped \
  -e ELASTICSEARCH_HOSTS=http://es.1989v.com:9200 \
  -p 5601:5601 \
  docker.elastic.co/kibana/kibana:8.13.0
# → http://localhost:5601

# Kafka UI (Provectus) — Kafka 토픽 관리
docker run -d --name kafka-ui --restart unless-stopped \
  -e KAFKA_CLUSTERS_0_NAME=oci \
  -e KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka.1989v.com:19092 \
  -p 8080:8080 \
  provectuslabs/kafka-ui:latest
# → http://localhost:8080
```

> docker container 가 WARP 라우팅 못 받으면 `--network host` 추가. Kafka 의
> `bootstrap.servers` 가 외부 hostname 으로 응답하려면 advertised listener 가
> `kafka.1989v.com:19092` 로 설정돼있어야 함 (oci-arm overlay patch 에서 처리).

### 5.6 트러블슈팅 — 표준 컨벤션 유지하며 진단

증상 별 진단:

| 증상 | 원인 | 표준 fix (fallback 금지) |
|------|------|------|
| `nslookup` 이 `100.80.x.x` 아니라 public anycast | WARP 가 DNS 가로채기 못 함 | Split Tunnel Include 에 `100.80.0.0/16` 등록 확인 |
| `dig @127.0.2.2 mysql.X` → REFUSED | cloudflared 가 private hostname routing 미지원 (구버전) | cloudflared 2025.7.0+ 로 업그레이드 (`deployment.yaml` image tag) |
| `cloudflared` 로그에 `failed to sufficiently increase receive buffer size` | QUIC UDP buffer 부족 | sysctl-tuning DaemonSet 적용 확인 (`net.core.rmem_max=7500000`) |
| 인증 페이지에서 `Error: Please enable WARP` | Split Tunnel 이 인증 도메인 우회 | Split Tunnel Include 에 `<team>.cloudflareaccess.com` 추가 |
| mysql `Lost connection ... reading initial communication packet` | 위 3번 + Access 정책 미통과 조합 | 위 fix 들 다 적용 + `warp-cli disconnect; warp-cli connect` |
| 매 8시간마다 재인증 알림 | Cloudflare One Client 세션 만료 | 정상. 부담스러우면 5.3.3 세션 기간 24 hours 로 |

### 5.7 cleanup

```bash
# K8s 측
sudo k3s kubectl -n commerce delete secret cloudflared-tunnel-token
sudo k3s kubectl -n kube-system delete configmap coredns-custom
sudo k3s kubectl -n kube-system delete daemonset sysctl-tuning
# ArgoCD 가 cloudflared deployment + NetworkPolicy 는 자동 sync 로 관리

# Cloudflare 측 (dashboard)
# Tunnels → msa → Delete
# Routes → Hostname routes → 항목 삭제
# Access > Applications → 각 응용 프로그램 삭제
```

자세히는:
- [`k8s/overlays/oci-arm/cloudflared/README.md`](../../k8s/overlays/oci-arm/cloudflared/README.md)
- [`k8s/overlays/oci-arm/README.md`](../../k8s/overlays/oci-arm/README.md)

---

## 6. HTTP 서비스 Zero Trust Access — admin / argocd

§5 가 TCP 인프라 (mysql/postgres/...) 의 외부 접근을 다뤘다면, §6 은 **HTTP 서비스 (관리자 UI)** 에 인증 게이트 추가. 표준 패턴:

- §5 는 WARP private hostname routing (TCP) — `cloudflared` 가 받음
- §6 는 일반 Cloudflare proxied HTTPS — ingress-nginx 가 받고 **Access 가 인증 페이지로 redirect**

### 6.1 어디에 적용하나 — 신중하게 선택

| FE/서비스 | hostname | Access 적용 | 이유 |
|----------|----------|-----------|------|
| portal-fe | `1989v.com` (root) | ❌ | 공개 진입 페이지 (포트폴리오) |
| **admin-fe** | `admin.1989v.com` | ✅ | 관리자 페이지 (config 변경, 잡 트리거) |
| **argocd** | `argocd.1989v.com` | ✅ | 모든 cluster 권한, 가장 sensitive |
| quant-fe | `quant.1989v.com` | △ 보류 | 금전적 영향 — 운영 단계에서 적용 검토 |
| agent-viewer-fe | `agent.1989v.com` | △ 보류 | 내부 디버깅 |
| gifticon-fe | `gft.1989v.com` | ❌ | 공유 그룹용 |
| gateway API | `api.1989v.com` | ❌ | JWT 자체 인증 유지. Access 적용 시 외부 호출 깨질 위험 |
| `rt.*` (WebSocket/SSE) | `rt.1989v.com` | ❌ | long-lived connection — Access 호환성 별도 검증 필요 |

→ 1차로 **admin-fe + argocd 2개만** 적용. 나머지는 운영 단계에서 검토.

### 6.2 셋업 (각 hostname 당 ~5분, dashboard 만)

매니페스트 변경 없음 — 기존 Cloudflare proxied ingress 위에 Access 정책만 얹는다.

**Zero Trust → 액세스 제어 → 응용 프로그램 → 응용 프로그램 추가 → 자체 호스팅 및 프라이빗 → 공개 호스트 이름**

| 응용 프로그램 이름 | 공개 호스트 이름 |
|------------------|-----------------|
| `admin` | subdomain=`admin`, domain=`1989v.com`, path=비워두기 |
| `argocd` | subdomain=`argocd`, domain=`1989v.com`, path=비워두기 |

공통 설정:
- 정책: `allow-me` (Include Emails = 본인 이메일) — 재사용
- 인증: **Cloudflare One Client로 인증** — **끔** (HTTP 는 브라우저 인증 자동 redirect 로 충분)
- MFA 탭 / 브라우저 렌더링 등: 건드리지 X

### 6.3 검증

WARP 없이도 (또는 켜져있어도) 브라우저로:

```
https://admin.1989v.com
https://argocd.1989v.com
```

→ Cloudflare Access 인증 페이지 자동 redirect → 본인 이메일 입력 → 일회용 PIN → 통과 → 원래 페이지.

**24시간 세션** 유지 (5.3.3 의 글로벌 세션 기간). 그 후 재인증.

### 6.4 cleanup

```
Zero Trust → 액세스 제어 → 응용 프로그램 → admin / argocd → 삭제
```

매니페스트/ingress 는 그대로 유지됨 (Access 정책 레이어만 제거).

### 6.5 TCP (§5) vs HTTP (§6) 차이

| | §5 — TCP | §6 — HTTP |
|---|---------|----------|
| 응용 프로그램 type | 프라이빗 (Private hostname) | 공개 (Public hostname) |
| 인증 redirect | 브라우저 X (raw TCP) | 브라우저 자동 |
| Cloudflare One Client 토글 | **켬 필수** | 끔 (브라우저 인증으로 충분) |
| WARP 필요 | **필수** (CGNAT 라우팅) | 불필요 (공개 IP) |
| 모바일/외부 디바이스 접근 | WARP 설치 디바이스만 | 어디서든 브라우저로 |
| Tunnel | cloudflared connector | ingress-nginx (기존) |

### 6.6 추후 적용 후보

별도 task 로 진행:
- `quant.1989v.com` — Phase 3 운영 시점
- `agent.1989v.com` — 내부 디버깅 UI 강화 필요 시
- `api.1989v.com/admin/**` 만 path-based Access — gateway API path 분리 후

---

## 7. 참고 문서

- [ADR-0019: K8s 마이그레이션 결정 기록](../adr/ADR-0019-k8s-migration.md)
- [k8s/base/ 서비스 매니페스트](../../k8s/base/)
- [k8s/infra/local/ 로컬 최소 인프라](../../k8s/infra/local/README.md)
- [k8s/infra/prod/ 운영 인프라](../../k8s/infra/prod/README.md)
- [k8s/overlays/k3s-lite/ 로컬 overlay](../../k8s/overlays/k3s-lite/README.md)
- [k8s/overlays/prod-k8s/ 운영 overlay](../../k8s/overlays/prod-k8s/README.md)
- [k8s/overlays/oci-arm/ OCI Ampere overlay](../../k8s/overlays/oci-arm/README.md)
- [k8s/infra/prod/backup/ 백업 CronJob](../../k8s/infra/prod/backup/README.md)
- [.github/workflows/ CI/CD 워크플로](../../.github/workflows/README.md)
- [Cloudflare private hostname routing 공식 docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/cloudflared/connect-private-hostname/)
- [레거시 docker-compose 스냅샷](https://github.com/1989v/msa/tree/backup/docker-compose-snapshot) (필요 시 참조)
