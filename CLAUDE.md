# CLAUDE.md — Commerce Platform (MSA)

**On conflict**: CLAUDE.md wins over plugin/skill defaults.

---

## Commands

```bash
# Build
./gradlew build                                         # 전체 빌드
./gradlew :{service}:app:build                          # 단일 서비스 빌드
./gradlew :{service}:domain:test                        # 도메인 테스트 (Spring context 없음)
./gradlew jibBuildTar                                   # JVM 서비스 이미지 tar 생성 (Phase 2)

# Local deployment (k3d / k3s-lite)
kubectl apply -k k8s/overlays/k3s-lite                  # 인프라 + 서비스 + overlay 일괄
scripts/image-import.sh --all                           # jibBuildTar 산출물을 k3d/kind로 로드

# Production deployment (managed K8s)
kubectl apply -k k8s/infra/prod                         # Operator 기반 인프라
kubectl apply -k k8s/overlays/prod-k8s                  # 서비스 + HPA + PDB + TLS
```

과거 `docker compose` 기반 경로는 ADR-0019 Phase 6에서 제거됨.
레거시 참조가 필요하면 `backup/docker-compose-snapshot` 브랜치 사용.

---

## Architecture (Clean Architecture + MSA)

- 의존성 방향: 항상 안쪽 (Domain ← Application ← Infrastructure/Presentation)
- Domain 레이어: 프레임워크 의존 금지
- 서비스 간 DB 공유 금지, cross-reference 금지 (API 호출만)
- 구조 변경 시 ADR 필수 → `docs/adr/`
- 상세 → `docs/architecture/00.clean-architecture.md`

---

## Key Conventions (상세는 docs/ 참조)

- **모듈 구조 & 패키지** → `docs/architecture/module-structure.md`
- **테스트**: Kotest BehaviorSpec + MockK → `docs/standards/test-rules.md`
- **Kafka 토픽** → `docs/architecture/kafka-convention.md`
- **API 응답 포맷**: `ApiResponse<T>` → `docs/architecture/api-response.md`
- **Common 기능 로드**: Auto-Configuration (`kgd.common.*`) → `docs/architecture/common-features.md`
- **코드 생성 컨벤션**: 네이밍, DI 방향, 도메인 패턴 → `docs/adr/ADR-0014-code-convention.md`
- **멱등성 패턴**: Kafka Consumer 중복 처리 방어 → `docs/adr/ADR-0012-idempotent-consumer.md`
- **장애 대비 전략**: CircuitBreaker, DLQ, Rate Limiting, CQRS → `docs/adr/ADR-0015-resilience-strategy.md`
- **백업/복구**: XtraBackup + Binlog PITR → `docker/backup/README.md` (스크립트) · `k8s/infra/prod/backup/` (CronJob 래퍼)
- **K8s 전환**: 배포 모드 이원화, Eureka 제거, Jib → `docs/adr/ADR-0019-k8s-migration.md`

---

## Agent Behavior

- 리스크 분류 & 검증 루프 → `agent-os/standards/agent-behavior/confirmation.md`
- 구현 후 리뷰 → `agent-os/standards/agent-behavior/self-review.md`
- 문서 동기화 → `agent-os/standards/agent-behavior/doc-gardening.md`
- 탐색 우선, 증거 기반 → `agent-os/standards/agent-behavior/core-rules.md`
- 컴팩션 복구 → `agent-os/standards/agent-behavior/compaction.md`
- ADR 검토 후 구현, 충돌 시 중단 후 확인 요청

---

## Skill Routing Priority

작업 요청 시 (예: "새 기능 만들어줘", "이거 어떻게 동작해?", "구조 알려줘", "서비스 구현"):

1. **`/hns:start` 통합 진입점 우선** — 요청 분석 → 질의 응답 or 피처 파이프라인 자동 라우팅
   - 코드베이스 질의: 탐색/분석/설명으로 바로 처리
   - 피처 개발: shape → write → review → tasks → implement → validate 파이프라인
   - 모호한 요청: 코드베이스 탐색 후 판단, 필요시 피처 파이프라인 전환 제안
   - 병렬 분할 가능하면 Claude Teams + hns 조합
2. **hns 단독** — 병렬 불가능한 단일 기능
3. **superpowers 보조** — hns 부적합 시(아이디어 탐색, 비개발 논의)

> 이 규칙은 superpowers Skill Priority보다 우선합니다.

**생산물 위치 규칙**: superpowers 스킬의 기본 출력 경로(`docs/superpowers/specs/`)를 사용하지 않는다. 모든 생산물은 프로젝트 docs/ 구조에 맞게 배치:
- PRD / Spec → `docs/specs/`
- Plan → `docs/plans/`
- ADR → `docs/adr/`

---

## Navigation

| 영역 | 경로 |
|------|------|
| Architecture docs | `docs/architecture/` |
| ADRs (플랫폼) | `docs/adr/` |
| Feature specs | `docs/specs/` |
| Conventions | `docs/conventions/` |
| Standards | `agent-os/standards/` |
| Product context | `agent-os/product/` |

### 서비스별 문서

각 서비스 디렉토리에 `CLAUDE.md` + `docs/`가 있다. 서비스 작업 시 자동 로드됨.

| 서비스 | CLAUDE.md | 비고 |
|--------|-----------|------|
| product | `product/CLAUDE.md` | SSOT, Kafka 발행 |
| order | `order/CLAUDE.md` | 결제 연동, 상태 전이 |
| search | `search/CLAUDE.md` | ES 인덱싱, 4개 모듈 |
| gateway | `gateway/CLAUDE.md` | 인증 필터, Rate Limiting, K8s DNS 라우팅 |
| common | `common/CLAUDE.md` | 공유 라이브러리 |
| charting | `charting/CLAUDE.md` | Python/FastAPI, 독립 도메인 |
| analytics | `analytics/CLAUDE.md` | 이벤트 수집, 스코어 산출 (Kafka Streams + ClickHouse) |
| experiment | `experiment/CLAUDE.md` | A/B 테스트 플랫폼 |
| member | `member/CLAUDE.md` | 회원 식별, 프로필 관리 (최소 개인정보) |
| wishlist | `wishlist/CLAUDE.md` | 상품 위시리스트 (회원별) |
| auth | (미생성) | OAuth 인증, RBAC (ROLE_USER/SELLER/ADMIN) |
| gifticon | (미생성) | 기프티콘 관리, 공유 그룹 |
| code-dictionary | (미생성) | IT 개념 사전, OpenSearch 검색, 시각화 |
| inventory | (미생성) | 재고 관리, 예약 |
| fulfillment | (미생성) | 주문 풀필먼트 |
| warehouse | (미생성) | 창고 관리 |
| chatbot | (미생성) | 대화형 AI |
| admin | (미생성) | 백오피스 관리 도구 (FE only) |

> 서비스 특화 ADR은 해당 서비스의 `docs/adr/`에 위치 (예: `charting/docs/adr/`)

---

## Local Dev (K8s, k3d 기준)

- Profile: `SPRING_PROFILES_ACTIVE=kubernetes` (Deployment에 주입됨)
- 클러스터 기동 및 ingress 설치: `k8s/infra/local/ingress-nginx/README.md`
- 전체 인프라 + 앱 기동:
  ```bash
  kubectl apply -k k8s/overlays/k3s-lite
  scripts/image-import.sh --all     # 빌드한 이미지 tar 주입
  ```
- 인프라 최소 세트: MySQL/Redis/Kafka/Elasticsearch/OpenSearch/ClickHouse 단일 인스턴스 (k8s/infra/local/)
- Redis는 standalone으로 배포되며, 클러스터 모드를 요구하는 5개 서비스(gateway, product, gifticon, analytics, experiment)는 overlay에서 `SPRING_APPLICATION_JSON`으로 standalone 전환됨

## Deployment Modes (ADR-0019)

| Mode | 대상 | Overlay | Infra |
|---|---|---|---|
| `k3s-lite` | 로컬 k3d / 에지 단일노드 | `k8s/overlays/k3s-lite/` | `k8s/infra/local/` (plain StatefulSet) |
| `prod-k8s` | managed K8s (EKS/GKE/AKS) | `k8s/overlays/prod-k8s/` | `k8s/infra/prod/` (Operator 기반) |

## Backup & Disaster Recovery

- 백업 스크립트(source of truth): `docker/backup/scripts/` (Shell 기반, 변경은 여기서)
- 스토리지 플러그인: `docker/backup/storage-providers/` (S3/GCS/Local 교체 가능)
- 보관 정책: 풀백업 7일, binlog 2일
- **K8s 실행**: `k8s/infra/prod/backup/` — Dockerfile로 이미지 빌드 + CronJob으로 스케줄
- 상세 가이드: `docker/backup/README.md` (스크립트) · `k8s/infra/prod/backup/README.md` (K8s 배포)
