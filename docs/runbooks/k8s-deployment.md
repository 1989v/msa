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

## 5. 참고 문서

- [ADR-0019: K8s 마이그레이션 결정 기록](../adr/ADR-0019-k8s-migration.md)
- [k8s/base/ 서비스 매니페스트](../../k8s/base/)
- [k8s/infra/local/ 로컬 최소 인프라](../../k8s/infra/local/README.md)
- [k8s/infra/prod/ 운영 인프라](../../k8s/infra/prod/README.md)
- [k8s/overlays/k3s-lite/ 로컬 overlay](../../k8s/overlays/k3s-lite/README.md)
- [k8s/overlays/prod-k8s/ 운영 overlay](../../k8s/overlays/prod-k8s/README.md)
- [k8s/infra/prod/backup/ 백업 CronJob](../../k8s/infra/prod/backup/README.md)
- [.github/workflows/ CI/CD 워크플로](../../.github/workflows/README.md)
- [레거시 docker-compose 스냅샷](https://github.com/1989v/msa/tree/backup/docker-compose-snapshot) (필요 시 참조)
