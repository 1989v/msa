# 4. Cloud Native & DevOps

> Kubernetes 2-mode 배포, Operator 기반 인프라, Jib 컨테이너, CI/CD 자동화

---

## Kubernetes 2-Mode Deployment

동일한 서비스 매니페스트를 Kustomize overlay로 환경별 차별화.

| Mode | 대상 | Overlay | Infra |
|------|------|---------|-------|
| **k3s-lite** | 로컬 k3d, 에지 단일노드 | `k8s/overlays/k3s-lite/` | `k8s/infra/local/` (plain StatefulSet) |
| **prod-k8s** | managed K8s (EKS/GKE/AKS) | `k8s/overlays/prod-k8s/` | `k8s/infra/prod/` (Operator 기반) |

### Base Manifests

```
k8s/base/
├── gateway/          # Deployment + Service + ServiceAccount
├── product/
├── order/
├── search/
├── ... (20 services)
└── kustomization.yaml
```

모든 서비스는 동일한 패턴:
- Deployment (1 replica base)
- Service (ClusterIP)
- ServiceAccount
- Readiness/Liveness probe (Actuator `/health`)
- Graceful shutdown (45s termination, 5s preStop delay)

**코드 위치**: `k8s/base/`

---

### k3s-lite Overlay (개발/에지)

```yaml
# k8s/overlays/k3s-lite/kustomization.yaml
resources:
  - ../../infra/local/mysql
  - ../../infra/local/redis
  - ../../infra/local/kafka
  - ../../infra/local/elasticsearch
  - ../../infra/local/opensearch
  - ../../infra/local/clickhouse
  - ../../base

patches:
  - target: { kind: Deployment }
    patch: |
      - op: replace
        path: /spec/template/spec/containers/0/resources
        value:
          requests: { cpu: 50m, memory: 256Mi }
          limits:   { memory: 512Mi }
```

**핵심 패치**:
- 리소스 축소 (단일 노드에서 19개 서비스 + 인프라 구동)
- `ddl-auto: update` (Flyway 대신 Hibernate auto-schema)
- Redis Cluster → Standalone 전환 (5개 서비스)
- Startup probe 연장 (느린 Cold Start 대응)

---

### prod-k8s Overlay (운영)

```yaml
# k8s/overlays/prod-k8s/kustomization.yaml
resources:
  - ../../base
  - hpa/           # HorizontalPodAutoscaler
  - pdb/           # PodDisruptionBudget
```

**HPA 설정** (CPU 기반 오토스케일):

| Service | Min | Max | Target CPU |
|---------|-----|-----|-----------|
| gateway | 2 | 6 | 70% |
| product, order | 2 | 8 | 70% |
| search | 2 | 6 | 70% |
| analytics, experiment | 2 | 4 | 70% |
| 기타 | 2 | 4 | 70% |

**추가 설정**:
- 최소 2 replica (고가용성)
- PDB: `maxUnavailable: 1` (롤링 배포 안전성)
- Ingress TLS: cert-manager + Let's Encrypt
- 리소스: 200m CPU / 1Gi mem / 2Gi limit

---

## Operator 기반 인프라 (Production)

```
k8s/infra/prod/
├── cert-manager/           # TLS 자동화
├── sealed-secrets/         # Git-safe 암호화 시크릿
├── kafka/ (Strimzi)        # KafkaCluster + KafkaTopic CRs
├── mysql/ (Percona)        # HA MySQL + XtraBackup
├── redis/ (Bitnami Helm)   # 6-node Redis Cluster
├── elasticsearch/ (ECK)    # Elasticsearch 클러스터
├── opensearch/             # OpenSearch Operator
├── clickhouse/ (Altinity)  # ClickHouse 클러스터
├── monitoring/             # kube-prometheus-stack
└── backup/                 # CronJob 래퍼
```

**총 리소스**: ~48 Pods, ~54GiB RAM (3 nodes x 4CPU / 16GiB 권장)

---

## Jib 컨테이너 빌드

Docker daemon 없이 Gradle에서 직접 OCI 이미지 생성.

```kotlin
// buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts
jib {
    from { image = "eclipse-temurin:25-jre-alpine" }
    to {
        image = "${registry}/${imageName}"
        tags = setOf("latest", version.toString())
    }
    container {
        jvmFlags = listOf(
            "-XX:+UseContainerSupport",
            "-XX:MaxRAMPercentage=75.0",
            "-Djava.security.egd=file:/dev/./urandom"
        )
        user = "1000:1000"  // non-root
    }
}
```

**장점**:
- Docker daemon 불필요 → CI에서 DinD 제거
- 레이어 캐싱 최적화 (의존성/리소스/클래스 분리)
- 18개 JVM 서비스 일괄 빌드 (`./gradlew jibBuildTar`)

**이미지 네이밍**:
- `:product:app` → `commerce/product:latest`
- `:search:consumer` → `commerce/search-consumer:latest`
- `:code-dictionary:app` → `commerce/code-dictionary:latest`

**코드 위치**: `buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts`

---

## CI/CD Pipeline

```
Push/PR to main
    ↓
GitHub Actions (ci.yml)
    ├─ ./gradlew build (18 services)
    ├─ ./gradlew jibBuildTar (이미지 tar 검증)
    └─ kustomize build (매니페스트 렌더링 검증)

Tag push (v*)
    ↓
GitHub Actions (images.yml)
    └─ ./gradlew jib → GHCR push (tagged)
```

**Concurrency**: 같은 ref에 대해 진행 중인 워크플로우 자동 취소

**코드 위치**: `.github/workflows/ci.yml` · `.github/workflows/images.yml`

---

## One-Line Cluster Bootstrap

```bash
# 로컬 K8s 클러스터 원클릭 구동
scripts/k3d-up.sh

# 옵션
scripts/k3d-up.sh --core        # 핵심 서비스만
scripts/k3d-up.sh --infra-only  # 인프라만
scripts/k3d-up.sh --rebuild     # JVM 이미지 재빌드
```

**자동 수행**:
1. k3d 클러스터 생성
2. ingress-nginx Helm 설치
3. 인프라 (MySQL, Redis, Kafka, ES 등) StatefulSet 배포
4. 18 API + 5 FE/Python 서비스 배포
5. 로컬 백업에서 MySQL 자동 복원

**코드 위치**: `scripts/k3d-up.sh` · `scripts/image-import.sh`

---

## Kafka Infrastructure (KRaft)

로컬에서는 단일 노드 KRaft 모드로 Zookeeper 없이 운영.

```yaml
# k8s/infra/local/kafka/statefulset.yaml
env:
  - name: KAFKA_CFG_PROCESS_ROLES
    value: "controller,broker"    # Combined mode
  - name: KAFKA_CFG_CONTROLLER_QUORUM_VOTERS
    value: "1@kafka:9093"
```

프로덕션에서는 Strimzi Operator로 3-broker 클러스터 + KafkaTopic CRD.

---

## Ingress & Service Mesh

```
Client → ingress-nginx → gateway:8080 → service:port
```

- **ingress-nginx**: L7 라우팅, TLS termination
- **Gateway**: JWT 인증, Rate Limiting, 라우트 매핑
- Service Mesh (Istio): 미적용 (Gateway 레벨에서 충분)

---

*Code references: `k8s/` · `buildSrc/` · `.github/workflows/` · `scripts/` · `docs/adr/ADR-0019-k8s-migration.md`*
