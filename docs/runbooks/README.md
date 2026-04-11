# Runbooks — Quick Start

상세 가이드가 필요하면 각 문서 링크 참조. 이 파일은 "지금 당장 띄워야 할 때"
한 화면에 쓰는 필수 명령만 정리한다.

| 용도 | 문서 |
|------|------|
| K8s / k3s 배포 상세 (두 모드) | [`k8s-deployment.md`](k8s-deployment.md) |
| 로컬 개발 (bare-metal + k3d) | [`local-dev-setup.md`](local-dev-setup.md) |
| 레거시 docker-compose (보관) | [`docker-infra.md`](docker-infra.md) |

---

## 1. 로컬 k3d로 전체 스택 기동 (k3s-lite)

```bash
# 0. 한 번만: k3d 클러스터 + ingress-nginx
k3d cluster create commerce \
    --k3s-arg "--disable=traefik@server:*" \
    -p "80:80@loadbalancer" -p "443:443@loadbalancer" --agents 0

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false

# 1. 이미지 빌드 + k3d 주입 (코드 변경 시마다 재실행)
./gradlew jibBuildTar
scripts/image-import.sh --all

# 2. 인프라 + 앱 한 번에 apply
kubectl apply -k k8s/overlays/k3s-lite

# 3. 기동 대기 + 확인
kubectl -n commerce wait --for=condition=Ready pods \
    -l app.kubernetes.io/part-of=commerce-platform --timeout=600s
kubectl -n commerce get pods

# 4. 스모크
curl http://localhost/actuator/health/liveness
```

개별 서비스만 재빌드:

```bash
./gradlew :product:app:jibBuildTar
scripts/image-import.sh --service product
kubectl -n commerce rollout restart deploy/product
```

정리:

```bash
kubectl delete -k k8s/overlays/k3s-lite   # 앱 + 인프라 제거
k3d cluster delete commerce               # 클러스터 통째로 삭제
```

---

## 2. 운영 K8s 배포 (prod-k8s)

선행: ingress-nginx, cert-manager, Sealed Secrets, Strimzi, Percona MySQL
Operator, ECK, OpenSearch Operator, Altinity ClickHouse, kube-prometheus-stack
가 모두 설치돼 있어야 한다. 설치 순서는 [`k8s-deployment.md`](k8s-deployment.md)
§2.1 참조.

```bash
# 1. 인프라 CR apply (Operator 기반)
kubectl apply -f k8s/infra/prod/strimzi/kafka-cluster.yaml
kubectl apply -f k8s/infra/prod/strimzi/kafka-topics.yaml
kubectl apply -f k8s/infra/prod/percona-mysql/mysql-clusters.yaml
kubectl apply -f k8s/infra/prod/eck/elasticsearch.yaml
kubectl apply -f k8s/infra/prod/opensearch/opensearch-cluster.yaml
kubectl apply -f k8s/infra/prod/clickhouse/clickhouse-installation.yaml
helm upgrade --install redis bitnami/redis-cluster \
    --namespace commerce --values k8s/infra/prod/redis/values.yaml

# 2. DB 초기화 (최초 1회)
kubectl apply -f k8s/infra/prod/percona-mysql/init-databases-job.yaml

# 3. 이미지 빌드 + push (또는 .github/workflows/images.yml이 자동 처리)
./gradlew jib \
    -PjibRegistry=ghcr.io/1989v \
    -PjibTag=$(git rev-parse --short HEAD)

# 4. 앱 overlay apply (Ingress TLS 호스트는 사전 수정)
kubectl apply -k k8s/overlays/prod-k8s

# 5. 확인
kubectl -n commerce rollout status deploy/gateway --timeout=5m
kubectl -n commerce get pods,hpa,pdb,ing
curl https://api.commerce.example.com/actuator/health/liveness
```

백업 CronJob 배포:

```bash
docker build -f k8s/infra/prod/backup/Dockerfile \
    -t ghcr.io/1989v/backup-runner:latest .
docker push ghcr.io/1989v/backup-runner:latest
kubectl apply -k k8s/infra/prod/backup
```

---

## 3. 공통 조회

```bash
kubectl -n commerce get pods,svc,ingress
kubectl -n commerce logs deploy/gateway -f
kubectl -n commerce get events --sort-by=.lastTimestamp | tail -20
kubectl top nodes && kubectl top pods -n commerce
```

---

## 4. 모드 요약

| Mode | Overlay | Infra | 용도 |
|------|---------|-------|------|
| **k3s-lite** | `k8s/overlays/k3s-lite/` | `k8s/infra/local/` (plain StatefulSet) | 로컬 k3d, 에지 단일 노드 |
| **prod-k8s** | `k8s/overlays/prod-k8s/` | `k8s/infra/prod/` (Operator 기반) | EKS / GKE / AKS |

두 모드는 동일한 `k8s/base/` 매니페스트를 공유하며 overlay가 리소스 / HPA /
PDB / Ingress TLS / Redis 모드 등을 다르게 패치한다. 전환 배경과 설계 결정은
[ADR-0019](../adr/ADR-0019-k8s-migration.md) 참조.
