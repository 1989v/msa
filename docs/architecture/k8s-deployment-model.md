# Kubernetes Deployment Model

Commerce Platform의 현 배포 아키텍처. 2026-04-10 docker-compose → Kubernetes
이전 이후의 상태를 기록한다. 설계 결정 배경은 [ADR-0019](../adr/ADR-0019-k8s-migration.md),
step-by-step 운영 절차는 [`runbooks/k8s-deployment.md`](../runbooks/k8s-deployment.md).

---

## 1. 배포 모드 이원화

동일한 코드베이스가 두 가지 타겟으로 배포된다.

| 모드 | 대상 환경 | Overlay | Infra Stack |
|------|-----------|---------|-------------|
| **k3s-lite** | k3d 단일 노드 / 에지 k3s / CI 스모크 | `k8s/overlays/k3s-lite/` | `k8s/infra/local/` — plain StatefulSet (Operator 없음) |
| **prod-k8s** | managed K8s (EKS, GKE, AKS) | `k8s/overlays/prod-k8s/` | `k8s/infra/prod/` — Operator 기반 (Strimzi, Percona, ECK …) |

두 모드는 같은 `k8s/base/`를 공유하고, overlay가 리소스·스케일·HA 속성만
다르게 패치한다. Kustomize patches + label selector 패턴으로 base는 절대
수정하지 않는다.

---

## 2. 컴포넌트 토폴로지

```
┌────────────────────────────────────────────────────────────┐
│                   External Ingress Traffic                  │
│                           (HTTPS)                            │
└──────────────────────────┬─────────────────────────────────┘
                           │
                 ┌─────────▼────────┐
                 │  ingress-nginx   │  (Helm)
                 └─────────┬────────┘
                           │
                 ┌─────────▼────────┐
                 │  gateway         │  Spring Cloud Gateway (WebFlux)
                 │  (Ingress 대상)   │  AuthenticationFilter, RateLimiter
                 └─────────┬────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼────┐    ┌──────▼─────┐    ┌────▼─────┐   ... (18 apps)
    │ product  │    │   order    │    │  search  │
    │  :8081   │    │   :8082    │    │  :8083   │
    └─────┬────┘    └─────┬──────┘    └────┬─────┘
          │               │                 │
 ┌────────┴───────────────┴─────────────────┴────────┐
 │              Data Plane (DNS-based)                │
 ├────────────────────────────────────────────────────┤
 │  mysql-{service}-master   Percona Operator (prod)  │
 │  redis / redis-1..6       Bitnami Redis Cluster    │
 │  kafka:29092              Strimzi KafkaNodePool    │
 │  elasticsearch:9200       ECK                      │
 │  opensearch:9200          OpenSearch Operator      │
 │  clickhouse:8123          Altinity Operator        │
 └────────────────────────────────────────────────────┘
```

모든 서비스 디스커버리는 **K8s Service DNS**로 통일됐다. Gateway는
`http://product:8081`, `http://order:8082` 같은 cluster-internal URL로 바로
라우팅한다 (Eureka 완전 제거).

---

## 3. 디렉토리 구조

```
msa/
├── buildSrc/
│   └── src/main/kotlin/commerce.jib-convention.gradle.kts
│       └─ Spring Boot app 모듈에 Jib 자동 적용 (Phase 2)
│
├── k8s/
│   ├── base/                           ← 18개 서비스 공통 매니페스트
│   │   ├── kustomization.yaml          ← 전체 aggregator
│   │   ├── gateway/                    ← + ingress.yaml
│   │   ├── product/                    ← Deployment + Service + SA
│   │   ├── order/
│   │   ├── search/ search-consumer/ search-batch/
│   │   ├── auth/ member/ wishlist/ gifticon/
│   │   ├── inventory/ fulfillment/ warehouse/
│   │   ├── analytics/ experiment/ chatbot/
│   │   ├── code-dictionary/
│   │   └── agent-viewer-api/
│   │
│   ├── infra/
│   │   ├── local/                      ← Phase 3a — plain StatefulSet
│   │   │   ├── namespace.yaml          (commerce ns)
│   │   │   ├── mysql/                  단일 파드 + 17개 Service 별칭 + init SQL
│   │   │   ├── redis/                  standalone + redis, redis-1..6 별칭
│   │   │   ├── kafka/                  KRaft 단일 노드 (bitnamilegacy)
│   │   │   ├── elasticsearch/          8.15 단일 노드
│   │   │   ├── opensearch/             2.19 단일 노드
│   │   │   ├── clickhouse/             24.8 단일 노드
│   │   │   └── ingress-nginx/README.md (Helm 설치 안내)
│   │   │
│   │   └── prod/                       ← Phase 4 — Operator 기반
│   │       ├── cert-manager/           ClusterIssuer (letsencrypt-prod)
│   │       ├── sealed-secrets/         README (kubeseal workflow)
│   │       ├── strimzi/                Kafka CR + 14개 KafkaTopic
│   │       ├── percona-mysql/          단일 클러스터 + 17개 Service 별칭 + init Job
│   │       ├── redis/                  Bitnami Helm values
│   │       ├── eck/                    Elasticsearch CR (3 master + 2 data)
│   │       ├── opensearch/             OpenSearchCluster CR
│   │       ├── clickhouse/             ClickHouseInstallation CR
│   │       ├── monitoring/             kube-prometheus-stack + ServiceMonitor
│   │       │   └── dashboards/         ← Phase 6에서 이관한 3개 Grafana JSON
│   │       └── backup/                 Phase 5 — Dockerfile + CronJob x 2
│   │
│   └── overlays/
│       ├── k3s-lite/                   ← Phase 3c
│       │   ├── kustomization.yaml      infra/local + base 참조
│       │   ├── patches/
│       │   │   ├── resources-reduce.yaml
│       │   │   ├── ddl-auto-update.yaml
│       │   │   ├── startup-probe.yaml
│       │   │   └── redis-standalone-{svc}.yaml × 5
│       │   └── README.md
│       │
│       └── prod-k8s/                   ← Phase 3c
│           ├── kustomization.yaml      base만 참조 (infra는 prod 오퍼레이터)
│           ├── hpa.yaml                16개 HPA
│           ├── pdb.yaml                16개 PDB
│           ├── patches/
│           │   ├── replicas.yaml       (모든 앱 → 2)
│           │   ├── resources.yaml      (200m CPU / 1Gi req, 2 CPU / 2 GiB limit)
│           │   └── ingress-tls.yaml    (cert-manager annotation)
│           └── README.md
│
├── scripts/
│   └── image-import.sh                 k3d/kind 로컬 이미지 로더 (Phase 2)
│
├── .github/workflows/
│   ├── ci.yml                          build + jibBuildTar + kustomize validate
│   ├── images.yml                      GHCR push (main + tag)
│   └── README.md
│
└── docker/                             ← 대폭 축소됨 (Phase 6)
    ├── Dockerfile                      backup-runner + 향후 비 JVM 용도
    ├── backup/scripts/                 source of truth (CronJob 이미지가 COPY)
    ├── backup/config/
    ├── backup/storage-providers/
    ├── backup/crontab
    ├── backup/README.md
    ├── .env
    └── .env.example
```

**없어진 것**: `docker/docker-compose*.yml`, `docker/{nginx,mysql,elasticsearch,
clickhouse,debezium,monitoring}/`, `docker/backup/ha/`. 과거 상태가 필요하면
`backup/docker-compose-snapshot` 브랜치 참조.

---

## 4. 빌드 파이프라인 (Jib)

### 4.1 Convention Plugin

`buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts`가 Spring Boot
플러그인이 적용된 모든 app 모듈에 자동으로 Jib을 연결한다.

```kotlin
// build.gradle.kts (루트)
subprojects {
    pluginManager.withPlugin("org.springframework.boot") {
        apply(plugin = "commerce.jib-convention")
    }
}
```

Convention이 자동 결정하는 것:

- **이미지 이름**: project path 기반 (`:product:app` → `commerce/product`,
  `:search:consumer` → `commerce/search-consumer`)
- **Main class**: 18개 서비스에 대한 explicit lookup map. Spring Boot 4 +
  Java 25 환경에서 Jib 3.4.4의 ASM이 bytecode를 못 읽어 자동 탐색이 실패하는
  것에 대한 우회 (FAQ-정의 workaround).
- **Base image**: `eclipse-temurin:25-jre-alpine`
- **JVM flags**: `-XX:+UseContainerSupport`, `-XX:MaxRAMPercentage=75.0`,
  `-Djava.security.egd=file:/dev/./urandom`
- **Non-root user**: `1000:1000`
- **OCI labels**: source, vendor, title
- **Library 모듈(`common`) 자동 skip**: `bootJar` 비활성 모듈은 Jib 태스크도
  비활성화

### 4.2 빌드 명령

```bash
./gradlew jibBuildTar                              # 18개 tar 일괄 생성
./gradlew :product:app:jibBuildTar                 # 단일 서비스
./gradlew jib -PjibRegistry=ghcr.io/1989v          # 레지스트리 push
./gradlew jib -PjibRegistry=... -PjibTag=<sha>     # 커스텀 태그
```

### 4.3 로컬 이미지 주입

`scripts/image-import.sh`는 현재 `kubectl config current-context`를 보고
분기한다.

- `k3d-*` → `k3d image import`
- `kind-*` → `kind load image-archive`
- 기타 (순수 k3s 등) → 수동 tarball drop 안내

옵션: `--all` (전체), `--service <name>` (자동 경로 탐색), 또는 직접 tar
경로 인자.

### 4.4 CI 파이프라인

| 워크플로 | 트리거 | 역할 |
|---------|--------|------|
| `.github/workflows/ci.yml` | PR, main push | `./gradlew build` + `jibBuildTar` 검증 + kustomize 렌더 |
| `.github/workflows/images.yml` | main push, `v*` tag | `./gradlew jib`으로 GHCR에 push (태그: `latest`, commit SHA) |

---

## 5. 서비스 디스커버리 (DNS only)

### 5.1 결정 요약

[ADR-0019](../adr/ADR-0019-k8s-migration.md) §Decision §1에서 **전략 B(순수
K8s Service DNS)**를 선택했다. 이유:

- 기존 코드에서 Eureka `lb://` 의존 지점이 Gateway 라우트 11개 + yml 2개뿐
- 서비스 간 내부 HTTP 호출은 order 서비스 한 곳만 있고, 이미 URL 주입 방식
- Spring Cloud Kubernetes LB 도입 시 RBAC (Role/RoleBinding/SA) 부담이 추가됨
  대비 이득 없음

### 5.2 적용 결과

- `:discovery` 모듈 삭제 (Phase 1b)
- 16개 서비스에서 `spring-cloud-starter-netflix-eureka-client` 의존성 제거
- 45개 `application*.yml`에서 `eureka:` 블록 제거
- `GatewayRouteConfig.kt`의 `lb://auth-service` → `http://auth:8087` 등 11개
  라우트 치환
- `gateway/application.yml`의 analytics/experiment 라우트 2개 동일 치환
- Spring Cloud Kubernetes 도입 없음, RBAC 불필요

### 5.3 현재 서비스 이름 규약

K8s Service 이름 = 과거 docker-compose container 이름. 예:

| 서비스 | K8s Service | 포트 |
|--------|-------------|------|
| gateway | `gateway` | 8080 |
| product | `product` | 8081 |
| mysql-product master | `mysql-product-master` | 3306 |
| redis | `redis`, `redis-1..6` | 6379/6380/…/6384 |
| kafka | `kafka` | 29092 |

`application-kubernetes.yml`이 이 이름들을 그대로 참조하기 때문에 서비스
코드 수정이 필요 없다.

---

## 6. 인프라 이원화 상세

### 6.1 로컬 (`k8s/infra/local/`)

모든 데이터 컴포넌트가 **단일 파드**로 존재한다. 운영 semantics와 다르지만
로컬 k3d에서 빠르게 띄우기 위한 타협.

- **MySQL**: 단일 `StatefulSet` (`mysql-0`), 12개 데이터베이스를 한 인스턴스에
  호스팅. `mysql-product-master`, `mysql-product-replica`, `mysql-order-master` 등
  **17개 Service 별칭**이 모두 같은 파드를 가리킨다. init ConfigMap이 최초
  기동 시 12개 DB와 유저를 생성.
- **Redis**: standalone `redis-0`. `redis`, `redis-1..6` 7개 Service 별칭.
  Spring Data Redis **cluster 클라이언트**는 CLUSTER 커맨드 응답을 기대하지만
  standalone Redis는 거부하므로, k3s-lite overlay에서 해당 5개 서비스
  (gateway, product, gifticon, analytics, experiment)에 `SPRING_APPLICATION_JSON`
  오버라이드로 standalone 모드로 강등한다.
- **Kafka**: KRaft 단일 노드 (`bitnamilegacy/kafka:3.8`). `kafka:29092`
  internal listener.
- **Elasticsearch / OpenSearch**: single-node, security off, 512m heap.
- **ClickHouse**: single-node, DB `analytics`.

리소스 합계: request ~4 GiB, limit ~6.75 GiB. Docker Desktop 메모리 12 GiB
이상 권장.

### 6.2 운영 (`k8s/infra/prod/`)

Operator 기반. CR을 apply하면 오퍼레이터가 StatefulSet/PVC/Service를 생성.

| Operator | Purpose | 노드 수 (기본) |
|----------|---------|----------------|
| Strimzi Kafka | KRaft Kafka + KafkaTopic 선언형 관리 | 3 controller + 3 broker |
| Percona MySQL | group-replication + Router proxy + XtraBackup 백업 | 3 |
| Bitnami Redis Cluster (Helm) | 6노드 cluster (3 master + 3 replica) | 6 |
| ECK | Elasticsearch cluster | 3 master + 2 data |
| OpenSearch Operator | OpenSearch cluster (code-dictionary 용) | 1 (scale-up 가능) |
| Altinity ClickHouse | Sharded ClickHouse | 1 shard (scale-up 가능) |
| cert-manager | Let's Encrypt TLS | — |
| Sealed Secrets | Secret 봉인 | — |
| kube-prometheus-stack | Prometheus + Alertmanager + Grafana | — |

모든 CR의 초기 설정은 scaffolding 수준이다. 실 운영 진입 전 반드시 ADR-0019
**Follow-up 체크리스트**를 따라 HPA min/max, resource limit, TLS 도메인,
Secret 봉인, 스토리지 클래스 등을 실제 값으로 교체한다.

---

## 7. 백업 & 복구

### 7.1 아키텍처

```
┌──────────────────────────┐
│ docker/backup/scripts/   │   source of truth (Shell + XtraBackup)
│  ├─ backup-full.sh       │
│  ├─ binlog-archive.sh    │
│  └─ storage-providers/   │   s3 / gcs / local 플러그인
└──────────┬───────────────┘
           │  COPY
┌──────────▼───────────────────┐
│ k8s/infra/prod/backup/       │   Phase 5 — CronJob 래퍼
│  ├─ Dockerfile               │   debian:12-slim + xtrabackup + aws/gsutil
│  ├─ cronjob-full.yaml        │   매일 02:00 Asia/Seoul
│  ├─ cronjob-binlog.yaml      │   매 시간
│  ├─ pvc.yaml (50Gi)          │
│  └─ secret.yaml (sealed)     │
└──────────────────────────────┘
```

### 7.2 흐름

1. Percona/MySQL 인스턴스에 대해 CronJob이 `backup-full.sh` 실행
2. XtraBackup 스트림을 `/backup` PVC에 staging
3. `upload.sh`가 storage provider (S3 / GCS / local)로 전송
4. `cleanup.sh`가 보관 기간(기본 7일) 초과 백업 삭제
5. 복구는 `restore-mysql.sh --db <name> --date <YYYY-MM-DD> [--pitr <time>]`

### 7.3 장기 목표

Phase 5는 "기존 셸을 그대로 래핑"해서 리스크를 최소화한 선택이다. 안정화
이후 Percona Operator의 `PerconaServerMySQLBackupSchedule` CR로 migrate하는
것이 권장 경로 (ADR-0019 §Follow-up).

---

## 8. 관측성 (Observability)

- **Prometheus**: kube-prometheus-stack (Helm). 앱 pod들의
  `/actuator/prometheus` endpoint를 `ServiceMonitor` (`commerce-platform-apps`)
  로 스크랩.
- **Grafana**: sidecar가 `grafana_dashboard: "1"` 라벨 ConfigMap을 자동 import.
  Phase 6에서 이관한 3개 대시보드:
  - `grafana-dashboard-http` — HTTP 메트릭
  - `grafana-dashboard-jvm` — JVM 메트릭
  - `grafana-dashboard-service-overview` — 서비스 오버뷰
- **Alertmanager**: kube-prometheus-stack 기본 포함. 알림 라우팅은 후속 작업.
- **Tracing / Logging**: 현 phase의 범위 밖. (ELK, Zipkin 등 과거 스텁은
  Phase 6에서 제거됨.)

---

## 9. 변환 이력 (Phase 요약)

| Phase | 커밋 | 핵심 변경 |
|-------|------|-----------|
| 0 | 73f755e (ADR) | `backup/docker-compose-snapshot` 브랜치 생성, ADR-0019 작성 |
| 1a | 73f755e | `application-kubernetes.yml` 추가, Actuator probe 그룹, graceful shutdown |
| 1b | 3b5ea9a | Eureka 완전 제거, `:discovery` 모듈 삭제, Gateway `lb://` → `http://` |
| 2 | ad5837f | buildSrc Jib convention, `scripts/image-import.sh` |
| 3a | 1b34b63 | `k8s/infra/local/` — plain StatefulSet 최소 인프라 |
| 3b | f8d7d9c | `k8s/base/` — 18개 서비스 Deployment + Service + SA + Ingress |
| 3c | 04e700a | `k8s/overlays/{k3s-lite, prod-k8s}/` — 2가지 배포 모드 |
| 4 | eca9b36 | `k8s/infra/prod/` — Operator 기반 인프라 scaffolding |
| 5 | 5816920 | `k8s/infra/prod/backup/` — CronJob 래퍼 |
| 6 | e9987a8 | docker-compose 자산 완전 제거 + 대시보드 이관 + CLAUDE.md 갱신 |
| 스모크 | 9d85852 | k3d 실배포 결과 fix: `bitnamilegacy/kafka:3.8`, `jdbc-url:`, ddl-auto, startup probe |
| Jackson fix | c186f84 | Spring Boot 4의 Jackson 3 namespace 갭 브리지 (`CommonJacksonAutoConfiguration`), `@Primary` KeyResolver |
| 7 (scoped) | bab46f2 | GitHub Actions CI + GHCR 이미지 publish |

총 12 커밋 + 1 백업 브랜치. 사전 존재 버그 6건을 스모크 과정에서 식별·수정
했고, 그중 Jackson 3 namespace 이슈가 가장 영향이 컸다.

---

## 10. 알려진 제한과 후속 작업

ADR-0019 §Consequences와 k3s-lite/prod-k8s README의 체크리스트에 상세. 핵심:

1. **Secret 실제화**: `k8s/infra/prod/**`의 placeholder를 모두 Sealed
   Secret으로 봉인.
2. **도메인 치환**: `k8s/overlays/prod-k8s/patches/ingress-tls.yaml`의
   `api.commerce.example.com`을 실제 도메인으로.
3. **HPA 튜닝**: 메트릭 확보 후 서비스별 min/max/target 재조정.
4. **MySQL 분리 결정**: prod에서 단일 클러스터 + 12 schema → per-service
   클러스터 이관 여부.
5. **Percona `BackupSchedule` CR 마이그레이션**: Phase 5 래퍼 안정화 후.
6. **Redis cluster null 패치 검증**: k3s-lite overlay의 Spring Data Redis
   null 처리 가 Lettuce에서 항상 안정적인 것은 아님. 실패 시 real 6-node
   cluster로 대체.
7. **Phase 7 확장**: charting (Python/FastAPI), frontend 앱 컨테이너화.
   본 phase는 CI/CD만 최소 범위로 처리.
8. **GitOps 도구 (ArgoCD/Flux) 도입**: 수동 `kubectl apply`를 선언형으로
   대체.

---

## 참고

- [ADR-0019: K8s 마이그레이션 결정 기록](../adr/ADR-0019-k8s-migration.md)
- [runbooks/README.md](../runbooks/README.md) — 핵심 명령 요약
- [runbooks/k8s-deployment.md](../runbooks/k8s-deployment.md) — 전체 배포 가이드
- [runbooks/local-dev-setup.md](../runbooks/local-dev-setup.md) — 로컬 개발
- [buildSrc Jib convention](../../buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts)
- [k8s/base/](../../k8s/base/) · [k8s/infra/](../../k8s/infra/) · [k8s/overlays/](../../k8s/overlays/)
- [.github/workflows/README.md](../../.github/workflows/README.md)
