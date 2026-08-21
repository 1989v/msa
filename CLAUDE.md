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
# 선행: Operator/Helm 설치 + SealedSecret 3종 (k8s/infra/prod/sealed-secrets/README.md)
kubectl apply -k k8s/infra/prod                         # Operator CR + DB/계정 init Job
kubectl apply -k k8s/overlays/prod-k8s                  # 서비스 + HPA + PDB + TLS + DB 비밀번호 주입
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
- **외부 데이터 연동 3규칙 (필수)**: ① 원천 필드는 **전부** 적재 — 지금 안 써도 컬럼으로 남긴다(원천 호출은 일일 한도 자원이라 다시 받으려면 그 한도를 또 쓴다) ② 가공은 원천을 덮지 않고 **파생 컬럼**으로 ③ 전체 동기화 경로의 필드 목록도 함께 갱신(안 하면 다음 배치가 새 컬럼을 지운다) → `docs/architecture/data-sources.md` §0
- **원천 데이터 대장 (외부 데이터를 붙이면 필수 갱신)**: 출처·라이선스·키 필요 여부·받는 방법 → `docs/architecture/data-sources.md`. 출처표시 의무가 있는 것(GeoNames CC BY 4.0, TourAPI 공공누리, 참가격 KOGL 제1유형)이 섞여 있어 **코드에만 있고 대장에 없으면 없는 것으로 친다**
- **FE 디자인 가드레일**: AI slop 방지, 타이포/색상/레이아웃/모션/접근성 → `docs/conventions/frontend-design.md`
- **DESIGN.md 표준 (필수)**: FE 코드 작성 / UI 화면 생성 전 **반드시 root `DESIGN.md` 의 토큰을 우선 참조**. hex 직접 입력 금지. 상세 표준 → `docs/standards/design-md.md`, 인스턴스 → `DESIGN.md`
- **FE 화면 검증 (필수)**: 색 대비·테마·기기 설정 분기는 tsc/build 가 못 잡는다. `눈으로 봤다` 대신 **CDP 로 잰 값**을 남긴다 — 독립 프로필 헤드리스 크롬 + `Emulation.setEmulatedMedia` 로 기기×사이트 4조합. chrome-devtools MCP 가 막혀도 **락 파일을 지우지 않는다**(프로필이 깨져 알럿이 반복된다) → `docs/standards/fe-visual-verification.md`
- **브랜드 면 디자인 작업 (필수)**: `/`·`/portfolio`·`resume`·`/shop`·`place`·`/games` 를 손대기 전 **`docs/design/k-heritage.html` 을 먼저 연다**. 재료·표면·활자·여백·형태·상태·프리미티브가 **살아 있는 견본**으로 있고 원본 시안 13장이 함께 있다. DESIGN.md §12 는 규칙 요약이고, 무엇이 어떻게 보이는지는 이 문서가 원본이다. 규칙을 바꿨으면 이 문서도 같이 고친다 — 문서가 코드와 어긋나면 다음 사람이 되돌린다.
- **@Transactional 규칙**: 외부 IO 분리, 중첩 txn 예외 금지, 클래스 레벨 주의 → `docs/conventions/transactional-usage.md`
- **로깅 규칙**: kotlin-logging 필수, 람다 형식, error 레벨 규칙 → `docs/conventions/logging.md`
- **Entity 수정 규칙**: 전체 동기화 vs 부분 수정 분리, 캡슐화 → `docs/conventions/entity-mutation.md`
- **문서-소스 추적**: `doc_map.py` / `doc_scan.py`, `docs/doc-index.json` 정책, `docs/doc-index.lock.json` 검증 → `docs/standards/doc-index-tracking.md`
- **Latency Budget**: latency 를 설계 입력으로 강제 + Tier 1 P99 SLA + 측정 표준 → `docs/adr/ADR-0025-latency-budget.md` (실천: `docs/conventions/latency-budget.md`)
- **docs 분류 정책**: ADR vs Conventions vs Standards 의 정의 / 판단 기준 / 분해 원칙 / redirect 표준 → `docs/adr/ADR-0026-docs-taxonomy.md`
- **이력서 사이트**: `resume.1989v.com` — DB(마크다운) 서빙 + 공개 토글 + 제출처별 토큰 게이트 + 열람 기록 → `docs/adr/ADR-0064-resume-site-gated-serving.md`. **본문은 레포가 아니라 DB가 원본**이고 어드민에서 편집한다 (공개 레포에 이력서 원문을 두면 게이트가 무의미해진다). 초기 데이터만 이력서 볼트에서 가져왔고, 이후 볼트와 사이트는 독립적으로 갱신된다
- **새 서브도메인 서비스 체크리스트 (필수)**: 서비스를 `x.1989v.com` 으로 올릴 때 —
  ① ingress host 블록(`k8s/overlays/oci-arm/ingresses/`) ② `App.tsx` host 분기 + apex 리다이렉트
  ③ 프리렌더 `_hosts/$host` 키(ADR-0062) ④ **`portal-fe/src/shell/serviceHref.ts` 의 `SUBDOMAIN_ORIGIN` 에 한 줄**.
  ④ 를 빠뜨리면 메인 타일이 apex 경로를 걸고 클릭 후 JS 로만 넘어간다 — 도착은 하므로 눈에 안 띄지만
  hover·링크복사·새 탭·크롤러가 전부 apex 에 머문다 (ADR-0066 개정 2026-08-20).
  Origin 인증서는 `*.1989v.com` 와일드카드라 **재발급 불요**. DNS 는 proxied(orange) 필수 (ADR-0061)
- **블로그**: `blog.1989v.com` — 계층 카테고리 + 다중 저자 + 상호작용 → `docs/adr/ADR-0072-blog-platform.md`.
  **작성 권한은 전역 Role enum 이 아니라 `blog_profile` 행이 갖는다** — 역할 하나로는 핸들·표시명을 담지 못하고,
  권한 진실이 JWT 와 두 군데로 갈리면 정지 처분이 토큰 만료 전까지 먹지 않는다. 좋아요·평점은 익명 허용,
  댓글만 로그인. 조회수는 Redis 가 아니라 `blog_post_view` 원장(하루 1표) — 부수로 일별 추이가 남는다
- **배포 안전장치**: Argo 동기화가 20분 넘게 `Running` 이면 워치독 CronJob 이 작업을 끊는다 + `ApplyOutOfSyncOnly` 로 변경분만 적용 → `docs/adr/ADR-0073-deploy-pipeline-guardrails.md`.
  **워치독은 Argo 가 배포하지 않는다** — 막힌 것을 푸는 물건을 막힌 것이 배포하면 같이 막힌다.
  `k8s/argocd/install.sh` 가 직접 apply 하므로, 워치독을 고치면 install.sh 를 다시 돌려야 반영된다
- **혜택 링크 허브**: `deal.1989v.com` — 카테고리별 혜택 링크 큐레이션 + 자체 리다이렉터 → `docs/adr/ADR-0069-deal-affiliate-hub.md`. **규제 업권(의료·금융)은 카테고리 행 자체를 만들지 않는다**(의료법 27조·금소법). 제휴 링크는 `AFFILIATE`/`PLAIN` 로 갈라 고지를 제휴에만 붙이고, `target_url` 은 **원본 무변조**로 302 한다 — 파라미터를 손대면 약관 위반이고 트래킹 쿠키가 깨진다
- **SEO / AEO / 검색 유입**: 빌드타임 프리렌더(호스트별), 언어(`/en`)·장르(`/games/genre/*`)·관광지(`/attractions/:id`) URL 승격, 호스트별 robots/sitemap/llms.txt, 구조화 데이터 → `docs/adr/ADR-0062-seo-and-organic-discovery.md`. 카피 SSOT 는 `portal-fe/src/seo/copy.mjs` — 타이틀/설명 문구는 여기서만 고친다. **호스트로 갈리는 경로(`/`, `/en`)는 프리렌더도 반드시 `_hosts/$host` 키를 써야 한다** (경로만 보면 다른 서비스 페이지가 샌다)

---

## Agent Behavior

- 리스크 분류 & 검증 루프 → `docs/standards/agent-behavior.md`
- 구현 후 리뷰 → `docs/standards/agent-behavior.md`
- 문서 동기화 → `docs/standards/agent-behavior.md`
- 탐색 우선, 증거 기반 → `docs/standards/agent-behavior.md`
- 컴팩션 복구 → `docs/standards/agent-behavior.md`
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
| Standards | `docs/standards/` |
| Product context | `docs/product/` |
| Study notes (백엔드 시니어 학습 노트) | `study/` — 19 주제 / 355 파일 / ~107K 줄. entry: `study/CLAUDE.md`, master index: `study/docs/00-INDEX.md`, ADR 후보: `study/docs/00-ADR-CANDIDATES.md` |

### 서비스별 문서

각 서비스 디렉토리에 `CLAUDE.md` + `docs/`가 있다. 서비스 작업 시 자동 로드됨.

| 서비스 | CLAUDE.md | 비고 |
|--------|-----------|------|
| product | `product/CLAUDE.md` | SSOT, Kafka 발행 |
| order | `order/CLAUDE.md` | 결제 연동, 상태 전이 |
| search | `search/CLAUDE.md` | OpenSearch 인덱싱, 4개 모듈 |
| gateway | `gateway/CLAUDE.md` | 인증 필터, Rate Limiting, K8s DNS 라우팅 |
| common | `common/CLAUDE.md` | 공유 라이브러리 |
| analytics | `analytics/CLAUDE.md` | 이벤트 수집, 스코어 산출 (Kafka Streams + ClickHouse) |
| experiment | `experiment/CLAUDE.md` | A/B 테스트 플랫폼 |
| member | `member/CLAUDE.md` | 회원 식별, 프로필 관리 (최소 개인정보) |
| wishlist | `wishlist/CLAUDE.md` | 찜하기 — 다형 대상(상품·게임·관광지·블로그 글), 로그인 전용, opaque targetKey (ADR-0074) |
| quant | `quant/CLAUDE.md` | 통합 트레이딩 플랫폼 — sealed Strategy(Tranche/Signal/Hybrid) + 차트 분석 + 입문자 지표 학습 CMS + Phase 3 실매매 (ADR-0033/0036/0037, Phase 3 코어 구현 완료, 거래소 어댑터 4종 wire-up 후 Beta) |
| auth | (CLAUDE.md 미작성) | OAuth 인증, RBAC (ROLE_USER/SELLER/ADMIN) — 서비스 코드 존재 |
| gifticon | (CLAUDE.md 미작성) | 기프티콘 관리, 공유 그룹 — 서비스 코드 존재 |
| code-dictionary | `code-dictionary/CLAUDE.md` | IT 개념 사전, OpenSearch 검색, 트리맵/그래프 시각화, 어드민 CRUD + 포트폴리오 카드. FE 는 portal-fe 단일 SPA 의 메인 콘텐츠로 통합 (2026-05-05, scroll anchor 기반). **game:feature 호스트** (ADR-0059) |
| game | `game/CLAUDE.md` | 게임 플랫폼 — 카탈로그(태그/큐레이션/평점) + 플레이 세션 + HOUSE 광고(후속). `:game:domain`+`:game:feature` 라이브러리로 code-dictionary:app 에 폴드, FE 는 portal-fe `/games/*` (ADR-0059) |
| inventory | (CLAUDE.md 미작성) | 재고 관리, 예약 — 서비스 코드 존재 |
| fulfillment | (CLAUDE.md 미작성) | 주문 풀필먼트 — 서비스 코드 존재 |
| warehouse | (CLAUDE.md 미작성) | 창고 관리 — 서비스 코드 존재 |
| chatbot | (CLAUDE.md 미작성) | 대화형 AI — 서비스 코드 존재 |
| admin | (CLAUDE.md 미작성) | 백오피스 관리 도구 (FE only) — admin/ 디렉토리 존재 |
| place | `place/CLAUDE.md` | 행정 지리 계층(대륙/국가/광역/도시) + POI + **관광지(Attraction) SSOT**, OpenSearch geo_distance 근처검색. 오픈데이터(GeoNames/상가정보/TourAPI) 적재 (ADR-0056/0065). 수집은 `place/ingest` CronJob 이 매일 자동 (ADR-0070) — 외부 :443 을 부르는 유일한 place 계열 파드. 운영 활성 (2026-08-09) |
| blog | `blog/CLAUDE.md` | 블로그 플랫폼 — 계층 카테고리(3단) + 다중 저자(등록제) + 댓글·평점·좋아요·조회수 + 글 상세 서버 meta 주입. `:blog:domain`+`:blog:feature` 라이브러리로 code-dictionary:app 에 폴드(스키마 공유), FE 는 portal-fe `blog.1989v.com` (ADR-0072) |
| deal | (CLAUDE.md 미작성) | 혜택 링크 허브 — 카테고리별 제휴/일반 혜택 링크 큐레이션 + `/go/{slug}` 리다이렉터 + 클릭 계측. `:deal:domain`+`:deal:feature` 라이브러리로 code-dictionary:app 에 폴드(스키마 공유), FE 는 portal-fe `deal.1989v.com` (ADR-0069) |

> charting 은 ADR-0036 P2-T20 에서 quant 로 통합 + Hard remove 완료 (2026-05-02). 서비스 특화 ADR 은 해당 서비스의 `docs/adr/`에 위치.

### Frontend 진입 구조 (2026-05-05 portal-fe 도입)

| Path | FE | 비고 |
|------|----|------|
| `/` (root catch-all) | `portal-fe` | **서비스 런처** (ADR-0066) — 브랜드 히어로 + 전시 서비스 타일 그리드(DB `display_service`, OPEN/PREOPEN) + 포트폴리오 타임라인 + About |
| `/tech` | `portal-fe` | 코드딕셔너리 — 트리맵/그래프/히트맵/검색 + 서비스 카탈로그. 옛 `/` 내용이 그대로 옮겨왔다 (lazy chunk) |
| `place.1989v.com` | `portal-fe` | K-관광/지리 탐색 (ADR-0065) — TourAPI 관광지 국문(`/`)·영문(`/en`) + 구글맵. game 과 같은 host 인식 루트 라우팅, apex `/place` 는 서브도메인으로 리다이렉트. 데이터: place SSOT → search attractions 인덱스 |
| `resume.1989v.com` | `portal-fe` | 이력서 — 같은 번들·같은 Service, 호스트로 분기. 공개 여부는 DB 설정 + 제출처별 토큰 게이트 (ADR-0064). 색인 대상 아님 |
| `deal.1989v.com` | `portal-fe` | 혜택 링크 허브 — 같은 번들·호스트 분기. `/go/{slug}` 는 gateway(아웃바운드 리다이렉터). **색인 대상 아님(noindex)** — 링크 모음만으로 색인되면 thin affiliate 판정이 사이트 전체에 번진다 (ADR-0069) |
| `blog.1989v.com` | `portal-fe` | 블로그 — 같은 번들·호스트 분기. **글 상세(`/posts/:slug`)와 작성자 공간(`/authors/:handle`)은 gateway 가 받아 백엔드가 meta 를 주입한 HTML 을 낸다** (ADR-0072 §6) — 발행 즉시 정확한 공유 카드·색인. 색인 대상 (deal/resume 과 반대) |
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
- 인프라 최소 세트: MySQL/Redis/Kafka/OpenSearch/ClickHouse 단일 인스턴스 (k8s/infra/local/)
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
