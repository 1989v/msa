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
scripts/image-import.sh --all                           # jibBuildTar 산출물(JVM)을 k3d/kind로 로드
scripts/image-import.sh --fe                            # FE 5종 docker build + 클러스터 로드
scripts/image-import.sh --all-images                    # 위 둘을 한 방에 (jib + FE)

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
- **코드 생성 컨벤션**: 네이밍, DI 방향, 도메인 패턴 → `docs/conventions/code-convention.md`
- **Kotlin 코드 스타일 & 리팩터링**: 관용구, null/불변, 애너테이션 순서, 코드 스멜 렌즈, behavior-preserving 정리 → `docs/conventions/kotlin-style.md`
- **JPA 영속성 컨벤션**: enum STRING, FK-as-ID / 연관관계 정책, Flyway+validate, Querydsl 조회 → `docs/conventions/jpa-persistence.md`
- **멱등성 패턴**: Kafka Consumer 중복 처리 방어 → `docs/conventions/idempotent-consumer.md` (실천 가이드, ADR-0012/0029)
- **장애 대비 전략**: CircuitBreaker, DLQ, Rate Limiting, CQRS → `docs/adr/ADR-0015-resilience-strategy.md`
- **백업/복구**: XtraBackup + Binlog PITR → `docker/backup/README.md` (스크립트) · `k8s/infra/prod/backup/` (CronJob 래퍼)
- **K8s 전환**: 배포 모드 이원화, Eureka 제거, Jib → `docs/adr/ADR-0019-k8s-migration.md`
- **FE 디자인 가드레일**: AI slop 방지, 타이포/색상/레이아웃/모션/접근성 → `docs/conventions/frontend-design.md`
- **DESIGN.md 표준 (필수)**: FE 코드 작성 / UI 화면 생성 전 **반드시 root `DESIGN.md` 의 토큰을 우선 참조**. hex 직접 입력 금지. 상세 표준 → `docs/standards/design-md.md`, 인스턴스 → `DESIGN.md`
- **@Transactional 규칙**: 외부 IO 분리, 중첩 txn 예외 금지, 클래스 레벨 주의 → `docs/conventions/transactional-usage.md`
- **로깅 규칙**: kotlin-logging 필수, 람다 형식, error 레벨 규칙 → `docs/conventions/logging.md`
- **Entity 수정 규칙**: 전체 동기화 vs 부분 수정 분리, 캡슐화 → `docs/conventions/entity-mutation.md`
- **문서-소스 추적**: `doc_map.py` / `doc_scan.py`, `docs/doc-index.json` 정책, `docs/doc-index.lock.json` 검증 → `docs/standards/doc-index-tracking.md`
- **Latency Budget**: latency 를 설계 입력으로 강제 + Tier 1 P99 SLA + 측정 표준 → `docs/adr/ADR-0025-latency-budget.md` (실천: `docs/conventions/latency-budget.md`)
- **docs 분류 정책**: ADR vs Conventions vs Standards 의 정의 / 판단 기준 / 분해 원칙 / redirect 표준 → `docs/adr/ADR-0026-docs-taxonomy.md`

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
| Study notes (백엔드 시니어 학습 노트) | `study/` — 19 주제 / 355 파일 / ~107K 줄. entry: `study/CLAUDE.md`, master index: `study/docs/00-INDEX.md`, ADR 후보: `study/docs/00-ADR-CANDIDATES.md` |

### 서비스별 문서

각 서비스 디렉토리에 `CLAUDE.md` + `docs/`가 있다. 서비스 작업 시 자동 로드됨.

| 서비스 | CLAUDE.md | 비고 |
|--------|-----------|------|
| product | `product/CLAUDE.md` | SSOT, Kafka 발행 |
| order | `order/CLAUDE.md` | 결제 연동, 상태 전이 |
| search | `search/CLAUDE.md` | ES 인덱싱, 4개 모듈 |
| gateway | `gateway/CLAUDE.md` | 인증 필터, Rate Limiting, K8s DNS 라우팅 |
| common | `common/CLAUDE.md` | 공유 라이브러리 |
| analytics | `analytics/CLAUDE.md` | 이벤트 수집, 스코어 산출 (Kafka Streams + ClickHouse) |
| experiment | `experiment/CLAUDE.md` | A/B 테스트 플랫폼 |
| member | `member/CLAUDE.md` | 회원 식별, 프로필 관리 (최소 개인정보) |
| wishlist | `wishlist/CLAUDE.md` | 상품 위시리스트 (회원별) |
| quant | `quant/CLAUDE.md` | 통합 트레이딩 플랫폼 — sealed Strategy(Tranche/Signal/Hybrid) + 차트 분석 + 입문자 지표 학습 CMS + Phase 3 실매매 (ADR-0033/0036/0037, Phase 3 코어 구현 완료, 거래소 어댑터 4종 wire-up 후 Beta) |
| auth | (CLAUDE.md 미작성) | OAuth 인증, RBAC (ROLE_USER/SELLER/ADMIN) — 서비스 코드 존재 |
| gifticon | (CLAUDE.md 미작성) | 기프티콘 관리, 공유 그룹 — 서비스 코드 존재 |
| code-dictionary | (CLAUDE.md 미작성) | IT 개념 사전, OpenSearch 검색, 트리맵/그래프 시각화, 어드민 CRUD — 서비스 코드 존재. FE 는 portal-fe 단일 SPA 의 메인 콘텐츠로 통합 (2026-05-05, scroll anchor 기반) |
| inventory | (CLAUDE.md 미작성) | 재고 관리, 예약 — 서비스 코드 존재 |
| fulfillment | (CLAUDE.md 미작성) | 주문 풀필먼트 — 서비스 코드 존재 |
| warehouse | (CLAUDE.md 미작성) | 창고 관리 — 서비스 코드 존재 |
| chatbot | (CLAUDE.md 미작성) | 대화형 AI — 서비스 코드 존재 |
| admin | (CLAUDE.md 미작성) | 백오피스 관리 도구 (FE only) — admin/ 디렉토리 존재 |

> charting 은 ADR-0036 P2-T20 에서 quant 로 통합 + Hard remove 완료 (2026-05-02). 서비스 특화 ADR 은 해당 서비스의 `docs/adr/`에 위치.

### Frontend 진입 구조 (2026-05-05 portal-fe 도입)

| Path | FE | 비고 |
|------|----|------|
| `/` (root catch-all) | `portal-fe` | MSA 진입점 — 단일 SPA 에 코드딕셔너리(트리맵/그래프/검색) + 포트폴리오 + 서비스 카탈로그 + 어바웃 섹션이 scroll anchor 로 통합 |
| `/admin/*` | `admin-fe` | 백오피스 |
| `/quant/*` | `quant-fe` | 트레이딩 (Phase 3) |
| `/gifticon/*` | `gifticon-fe` | 기프티콘 |
| `/agent-viewer/*` | `agent-viewer-fe` | AI 에이전트 viewer |
| `/api/v1/*`, `/sse/*`, `/ws/*`, `/actuator/*` | `gateway` | 백엔드 API (REST + SSE + WebSocket + actuator) |

ingress-nginx 의 longer-prefix-first 매칭 → sub-FE prefix 가 portal-fe 의 root catch-all 보다 우선. gateway 는 `/api`/`/sse`/`/ws`/`/actuator` specific path 만 받도록 좁힘 (이전: `/` catch-all).

### 도구 / 별도 레포

플랫폼 서비스가 아닌 사이드 레포지토리. msa 본 레포에 직접 빌드/배포되지 않으며, 개발 도구 또는 보조 앱.

| 레포 | 형태 | 위치 | 설명 |
|------|------|------|------|
| `ai` | submodule (`1989v/ai`) | `ai/` (msa 내부) | Claude Code 플러그인 모노레포 — hns / ai-debugger / private-repo / content-analyzer 4종 (`ai/CLAUDE.md`) |
| `muxbar` | sibling repo (`1989v/muxbar`) | `~/IdeaProjects/muxbar` | macOS menu bar 네이티브 앱 — tmux 세션 관리 + caffeinate 토글 (Swift 5.9+, macOS 13+) |

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
| `oci-arm` | OCI Ampere A1 free tier (arm64) | `k8s/overlays/oci-arm/` | `k8s/infra/local/` (k3s-lite 상속, nip.io + cert-manager) |
| `prod-k8s` | managed K8s (EKS/GKE/AKS) | `k8s/overlays/prod-k8s/` | `k8s/infra/prod/` (Operator 기반) |

## Backup & Disaster Recovery

- 백업 스크립트(source of truth): `docker/backup/scripts/` (Shell 기반, 변경은 여기서)
- 스토리지 플러그인: `docker/backup/storage-providers/` (S3/GCS/Local 교체 가능)
- 보관 정책: 풀백업 7일, binlog 2일
- **K8s 실행**: `k8s/infra/prod/backup/` — Dockerfile로 이미지 빌드 + CronJob으로 스케줄
- 상세 가이드: `docker/backup/README.md` (스크립트) · `k8s/infra/prod/backup/README.md` (K8s 배포)
