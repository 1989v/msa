# Commerce Platform (MSA)

실서비스 배포 가능 수준의 MSA 기반 커머스 플랫폼.
수평 확장, 이중화, k3d / k3s-lite 로컬 개발 환경, managed Kubernetes(EKS/GKE/AKS) 배포 가능 구조로 설계되었습니다.

> 구동 모드는 ADR-0019에 따라 k3d (로컬) / managed K8s (운영) 이원화. docker compose 경로는 Phase 6에서 제거됨.

---

## 서비스 구성

| 서비스 | 포트 | 설명 |
|--------|------|------|
| `gateway` | 8080 | Spring Cloud Gateway (인증/인가, 라우팅) — Eureka는 ADR-0019에서 K8s DNS로 대체 |
| `product` | 8081 | 상품 서비스 (CRUD, 재고 관리) |
| `order` | 8082 | 주문 서비스 (결제 연동, 이벤트 발행) |
| `search` | 8083 | 검색 서비스 (Elasticsearch 기반, 읽기 전용) |
| `search-consumer` | 8084 | Kafka 증분 색인 서비스 |
| `search-batch` | 8085 | Spring Batch 전체 색인 서비스 |
| `common` | — | 공통 라이브러리 모듈 |

> 전체 서비스 목록(auth/member/wishlist/gifticon/inventory/fulfillment/warehouse/analytics/experiment/chatbot/code-dictionary/agent-viewer-api/quant, FE 5종)은 [`CLAUDE.md`](CLAUDE.md) 참조. charting 은 ADR-0036 P2-T20 에서 quant 로 통합 + Hard remove (2026-05-02).

### 도구 / 별도 레포

플랫폼 서비스 아님. 본 레포 빌드/배포 대상 외이며 개발 도구 또는 보조 앱.

| 레포 | 형태 | 설명 |
|------|------|------|
| `ai` | submodule (`1989v/ai`, `ai/` 경로) | Claude Code 플러그인 모노레포 — hns / ai-debugger / private-repo / content-analyzer |
| `muxbar` | sibling repo (`1989v/muxbar`) | macOS menu bar 앱 — tmux 세션 관리 + caffeinate 토글 (Swift 5.9+) |

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 언어 | Kotlin 2.2.21, Java 25 |
| 프레임워크 | Spring Boot 4.0.3, Spring Cloud 2025.1.0 (Oakwood) |
| 아키텍처 | Clean Architecture |
| DB | MySQL 8.0 (Master/Replica R/W 분리) |
| ORM | JPA + QueryDSL |
| 캐시/락 | Redis 7.2 (Cluster 모드) |
| 메시징 | Apache Kafka |
| 검색 | Elasticsearch 8.17 (nori 형태소 분석기) |
| 외부 통신 | WebClient + Resilience4j CircuitBreaker |
| 인증 | JWT (RS256), AES-256-GCM 암호화 |
| 테스트 | Kotest BehaviorSpec + MockK |

---

## 인프라 (k3d 클러스터 내부)

K8s 환경에선 모든 인프라가 ClusterIP로만 노출됩니다. 호스트에서 접근하려면 `kubectl port-forward` 사용.

| Service (ClusterIP) | 포트 | 용도 |
|---------------------|------|------|
| `mysql` (+ 17개 alias) | 3306 | 서비스별 논리 DB (단일 인스턴스, ADR-0019 Phase 3a) |
| `redis` | 6379 | Standalone (운영은 cluster, k3s-lite는 standalone 자동 전환) |
| `kafka` | 9092 | KRaft 단일 노드 (Zookeeper 제거) |
| `elasticsearch` | 9200 | 검색 인덱싱 |
| `opensearch` | 9200 | code-dictionary 검색 |
| `clickhouse` | 8123 (HTTP), 9000 (TCP) | analytics / quant (ohlcv, kimchi_premium_tick, audit_event) |
| `quant-postgres` | 5432 | quant pgvector (패턴 임베딩) — Phase 2 옵셔널 |

```bash
# 호스트에서 mysql 접속하기
kubectl -n commerce port-forward svc/mysql 3306:3306
mysql -h 127.0.0.1 -P 3306 -uroot -p
```

운영(prod-k8s)에선 Operator 기반(Percona MySQL HA / Strimzi Kafka 등)으로 교체 — `k8s/infra/prod/`.

---

## 빠른 시작 (k3d / k3s-lite)

> 사전 요구: Docker, k3d, kubectl, helm, JDK 25. 프로덕션 배포는 [`k8s/overlays/prod-k8s/README.md`](k8s/overlays/prod-k8s/README.md) 참조.

### 0. 클러스터 + ingress-nginx (최초 1회)

```bash
k3d cluster create commerce \
    --k3s-arg "--disable=traefik@server:*" \
    -p "80:80@loadbalancer" -p "443:443@loadbalancer"

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false
```

자세한 옵션은 [`k8s/infra/local/ingress-nginx/README.md`](k8s/infra/local/ingress-nginx/README.md).

### 1. 이미지 빌드 & 클러스터 임포트

```bash
# JVM 서비스 (Spring Boot, Jib tar)
./gradlew jibBuildTar
scripts/image-import.sh --all

# FE 5종 (portal / admin / quant / gifticon / agent-viewer) — Docker daemon 필요
# portal = MSA 진입점 (root /). 사이트 = 포트폴리오 + 코드딕셔너리 + 서비스 카탈로그.
scripts/image-import.sh --fe

# 또는 위 둘을 한 방에:
scripts/image-import.sh --all-images
```

### 2. 인프라 + 서비스 일괄 기동

```bash
kubectl apply -k k8s/overlays/k3s-lite              # 인프라(MySQL/Redis/Kafka/ES/OpenSearch/ClickHouse) + 서비스 + ingress
kubectl -n commerce get pods -w                     # Ready 상태까지 대기
```

접속:
- `http://localhost/` — **portal** (MSA 진입점, 포트폴리오 + 코드딕셔너리 `/dict` + 서비스 카탈로그 `/services`)
- `http://localhost/admin/`, `/quant/`, `/gifticon/`, `/agent-viewer/` — sub-FE
- `http://localhost/api/v1/...` — gateway (REST), `/sse/...` `/ws/...` (long-lived), `/actuator/...` (헬스)

### 3. 서비스 단독 실행 (로컬 개발 / k8s 외부)

```bash
# 인프라만 기동된 상태에서 단일 서비스를 IDE/CLI로 실행
./gradlew :product:app:bootRun
./gradlew :quant:app:bootRun --args='--spring.profiles.active=local'
```

### 4. 정리

```bash
kubectl delete -k k8s/overlays/k3s-lite
kubectl -n commerce delete pvc --all                # 데이터까지 초기화하려면
k3d cluster delete commerce                         # 클러스터 자체 제거
```

---

## 빌드

```bash
# 전체 빌드
./gradlew build

# 서비스 앱 단독 빌드 (Nested Submodule 구조)
./gradlew :product:app:build
./gradlew :order:app:build
./gradlew :search:app:build

# 도메인 단독 테스트 (Spring Context 없음)
./gradlew :product:domain:test
./gradlew :order:domain:test
./gradlew :search:domain:test

# 테스트 제외 빌드
./gradlew build -x test

# K8s용 이미지 빌드 (Jib tar 산출물: */build/jib-image.tar)
./gradlew jibBuildTar                  # 전체
./gradlew :product:app:jibBuildTar     # 단일

# k3d/kind에 임포트 (FE/Python 포함)
scripts/image-import.sh --all-images
```

---

## 아키텍처

### Clean Architecture 레이어

```
domain/          # 비즈니스 규칙 (Spring 의존성 없음)
application/     # 유스케이스, 포트 인터페이스
infrastructure/  # JPA, Kafka, Redis, WebClient 구현체
presentation/    # REST Controller, DTO
```

- 의존성 방향: `presentation → application → domain` (단방향)
- `domain` 패키지는 Spring/JPA 어노테이션 사용 금지
- 서비스 간 DB 직접 접근 금지 (API 호출만 허용)

### Kafka 토픽

| 토픽 | 발행 | 수신 |
|------|------|------|
| `product.item.created` | product | search |
| `product.item.updated` | product | search |
| `order.order.completed` | order | — |
| `order.order.cancelled` | order | — |

### API 응답 포맷

모든 응답은 `ApiResponse<T>`로 래핑됩니다.

```json
// 성공
{ "success": true, "data": { ... }, "error": null }

// 실패
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "..." } }
```

---

## 모듈 구조

각 서비스는 `{service}:domain` / `{service}:app` 형태의 중첩 Gradle 서브모듈로 분리됩니다.

```
msa/
├── common/          # 공통 라이브러리 (bootJar 없음)
├── gateway/         # Spring Cloud Gateway (K8s DNS 라우팅, Eureka 제거)
├── product/         # 상품 서비스 (컨테이너)
│   ├── domain/      #   순수 도메인 모듈 (Spring/JPA 의존성 없음)
│   └── app/         #   Spring Boot 앱 (Application + Infrastructure + Presentation)
├── order/           # 주문 서비스 (컨테이너)
├── search/          # 검색 서비스 (app / consumer / batch + domain)
├── quant/     # 분할매매 전략 자동매매 (app + frontend PWA)
├── auth, member, wishlist, gifticon, inventory, fulfillment, warehouse,
│ analytics, experiment, chatbot, code-dictionary, agent-viewer/  # 서비스별 nested submodule
├── *-fe/, quant/frontend/                                       # FE (5종)
├── quant/ingest/                                                # Python sidecar (ClickHouse insert)
├── k8s/             # Kustomize 매니페스트
│   ├── base/        #   서비스 + FE 매니페스트 (env 무관)
│   ├── infra/       #   local (k3d) / prod (Operator 기반)
│   └── overlays/    #   k3s-lite (로컬) / prod-k8s (운영)
├── scripts/         # image-import.sh, k3d-up.sh, k3d-mysql-{dump,restore}.sh
├── docker/          # backup 스크립트, MySQL/ES init, JVM 베이스 Dockerfile
├── docs/            # 아키텍처 문서, ADR, specs, plans
└── gradle/
    └── libs.versions.toml  # Version Catalog (중앙 버전 관리)
```

---

## 백업 & 재해 복구

프로덕션 데이터 백업/복구 시스템이 `docker/backup/`에 구현되어 있습니다.

| 항목 | 설명 |
|------|------|
| 백업 방식 | Percona XtraBackup (MySQL) + rsync (파일) — pg_basebackup 은 charting Hard remove 후 비활성, quant pgvector 활성 시 재개 가능 |
| RPO | ~0 (Binlog PITR) |
| RTO | 수 분 (풀백업 복원 + binlog replay) |
| 스토리지 | S3 / GCS / Local 플러그인 방식 |
| 보관 | 풀백업 7일, binlog 2일 |
| 자동 페일오버 | Orchestrator + ProxySQL (비활성, 필요 시 활성화) |

상세 가이드: [docker/backup/README.md](docker/backup/README.md)

---

## 주요 도메인 — Quant (자동매매 통합 플랫폼)

`quant` 서비스는 분할매매 / 시그널 / 융합 전략 + 차트 분석 + 입문자 학습 CMS 를 통합한다.
Phase 별 출고 상태:

| Phase | 범위 | 상태 |
|---|---|---|
| 1 | 백테스트 엔진 + ClickHouse + REST + FE 스캐폴드 | 출고 |
| 2 | 페이퍼 트레이딩 + 빗썸 WebSocket + KEK 봉투 + cross-exchange 김치프리미엄 + Phase 3 도메인 | 출고 |
| 3 | 실매매 (4-layer 게이트 + 3-레벨 kill-switch + TOTP 2FA + SHA-256 audit chain) | ADR-0037 Accepted (코어 구현 완료, 거래소 어댑터 4종 wire-up 후 Beta) |

상세: [`quant/CLAUDE.md`](quant/CLAUDE.md), [`quant/docs/phase2-readiness.md`](quant/docs/phase2-readiness.md), [`docs/specs/2026-05-05-quant-phase3-live-trading/`](docs/specs/2026-05-05-quant-phase3-live-trading/planning/spec.md).

---

## 문서

- [아키텍처 결정 기록 (ADR)](docs/adr/) — ADR-0001 ~ ADR-0037
- [Clean Architecture 가이드](docs/architecture/00.clean-architecture.md)
- [데이터 전략](docs/architecture/data-strategy.md)
- [Resilience 전략](docs/architecture/resilience-strategy.md)
- [백업 설계 — 스크립트](docker/backup/README.md) · [K8s 배포](k8s/infra/prod/backup/README.md)
- [Phase 3 실매매 spec](docs/specs/2026-05-05-quant-phase3-live-trading/planning/spec.md) · [ADR-0037](docs/adr/ADR-0037-quant-phase3-live-trading.md)
- [구현 플랜](docs/plans/)
