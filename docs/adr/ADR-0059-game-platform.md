# ADR-0059 — Game Platform (게임 카탈로그 + 플레이 + 광고) 도입

- Status: Accepted (2026-07-06, MVP 우선 — ads 는 후속 페이즈)
- Date: 2026-07-06
- Supersedes: 없음 / Relates: ADR-0058(서비스 토폴로지 통합), ADR-0019(K8s 전환), ADR-0012/0029(멱등성), ADR-0025(Latency Budget)
- Spec: `docs/specs/2026-07-06-game-platform-entities-design.md` (엔티티 상세)

## Context

CrazyGames 모델(게임 리스트 + iframe 임베드 플레이 + SDK 중개 광고)의 게임 플랫폼을 도입한다.
코드베이스에는 이미 게임성 자산 5종이 존재하나(portal-fe 퀴즈 4종 = React 내장형,
agent-viewer pixel-office = Canvas/TS, 로컬 전용) 모두 호스트 앱에 하드코딩되어 있어
"게임 = 등록/발견/플레이/수익화 가능한 콘텐츠 단위"라는 플랫폼 개념이 없다.

아키텍처 결정이 필요한 지점:

1. **배치 형태** — ADR-0058 이 상주 JVM 과분할을 해소한 직후다. 신규 도메인이라고
   무조건 신규 `:app`(JVM 고정비 ~250–400MB)을 추가하면 ADR-0058 과 정면 충돌한다.
2. **게임 번들 호스팅** — IFRAME 게임의 정적 번들 서빙 위치.
3. **광고 집행 주체** — 외부 애드 네트워크 연동 vs 자체(HOUSE) 운영.
4. **FE 형태** — portal-fe 통합(2026-05~07 FE 통합 P1/P2 방향) vs sub-FE 분리.
5. **인게임 구매** — 스코프 포함 여부.

## Decision

### 1) 배치: `:game:domain` + `:game:feature` 라이브러리, `code-dictionary:app` 에 마운트

신규 상주 JVM 을 만들지 않는다. ADR-0058 모듈러 모놀리스 컨벤션을 그대로 적용:

- `game:domain` — 순수 Kotlin 도메인 (catalog / play / ads 3개 컨텍스트)
- `game:feature` — 컨트롤러·서비스·어댑터·Kafka 프로듀서 + **자체 datasource(`game_db` 스키마)
  + 자체 TM(`gameTransactionManager`) + Flyway**. `@SpringBootApplication` 없음.
- 호스트: **`code-dictionary:app`** 이 `game:feature` 를 의존에 추가.

호스트 선정 근거: code-dictionary 는 portal-fe 콘텐츠(개념 사전·퀴즈 데이터·포트폴리오)를
소유한 "포털 콘텐츠" JVM 이고, 게임 플랫폼의 트래픽 성격(공개 조회 중심, SLA Tier 아님)과
인프라 스택(MySQL/Redis)이 동일하다. 기존 퀴즈 4종의 데이터 공급자이기도 하다.

ADR-0058 불변식 준수 — 재분리 가능성 보장:
- `game:feature` ↔ `codedictionary` 컨텍스트 간 **직접 빈 주입 금지** (교차 import 컴파일 차단)
- 스키마·datasource·EMF·TM 분리 (`game_db`), `@Transactional("gameTransactionManager")` 명시
- 트래픽 증가 시 재분리 체크리스트 4단계로 `game:app` 추출 (feature·DB·토픽 무변경)

### 2) 게임 번들 호스팅: 정적 nginx 이미지 (`game-assets`)

- IFRAME 게임 번들(HTML5/Canvas 빌드 산출물)은 게임별 디렉토리로 담은 **nginx 정적
  이미지**로 빌드, ingress `/game-assets/{slug}/` 서빙. FE 5종과 동일한 배포 파이프라인
  (`scripts/image-import.sh --fe` 계열) 재사용.
- OCI Object Storage 는 게임 수·번들 크기가 이미지 리빌드를 비현실화할 때 도입 (후속 ADR).
- 기존 퀴즈 4종은 `INTERNAL_ROUTE` (portal-fe 라우트) — 번들 서빙 불필요.

### 3) 광고: HOUSE-only 로 시작, provider 추상화 유지

- 초기 집행은 **HOUSE**(자체 홍보 배너 — 플랫폼 내 다른 서비스/게임 홍보)만. 외부 네트워크
  (AdSense/GAM) 심사·수익화는 실트래픽 확보 후 별도 결정.
- 단, 엔티티(`AdPlacement.provider`, `provider_slot_id`)와 SDK 계약(postMessage `ad:*`)은
  처음부터 네트워크 중립으로 설계 — CrazyGames 와 동형 구조(플랫폼은 슬롯/정책/보상만 소유,
  집행은 provider 위임)를 HOUSE 로 먼저 검증한다.
- rewarded 보상은 `idempotency_key` 기반 1회 보장 (idempotent-consumer 패턴, ADR-0012/0029).

### 4) FE: portal-fe nested lazy route (`/games/*`)

admin 흡수(FE 통합 P2, 2026-07-06 merge)와 동일 패턴 — 별도 sub-FE 를 만들지 않고
portal-fe 에 lazy route 로 통합한다. 게임 플레이 화면은 route 내에서 IFRAME 임베드 또는
INTERNAL_ROUTE 컴포넌트 렌더. ingress 변경 불필요 (portal-fe 가 root catch-all).

### 5) 인게임 구매: 스코프 아웃

CrazyGames 도 선별 게임만 지원. 결제 연동은 order 서비스와의 경계 문제가 커서 별도 ADR 전까지 제외.

### 6) Kafka 토픽 (kafka-convention `{service}.{entity}.{event}` 준수)

| 토픽 | 발행 | 수신 |
|------|------|------|
| `game.session.started` | game(feature) | analytics |
| `game.session.ended` | game(feature) | analytics |
| `game.ad.logged` | game(feature) | analytics |

광고 노출/클릭/완료 원본 이벤트와 플레이 집계는 analytics(ClickHouse)가 소유,
`GameStats`(MySQL)는 주기 동기화 프로젝션.

## Consequences

- (+) 상주 JVM 증가 0 — ADR-0058 통합 기조 유지. 신규 비용은 code-dictionary JVM 내
  커넥션풀 1벌 + `game_db` 스키마.
- (+) 기존 게임 자산(퀴즈 4종)이 `INTERNAL_ROUTE` 게임으로 카탈로그에 등록 가능 —
  플랫폼 초기 콘텐츠 확보.
- (+) HOUSE 광고로 광고 파이프라인(슬롯→정책→보상 멱등→이벤트 집계) 전체를 외부 의존 없이 검증.
- (−) code-dictionary 배포가 game 변경에도 트리거됨 (co-deployment 트레이드오프, ADR-0058 과 동일 수용).
- (−) 게임 번들이 늘면 game-assets 이미지 리빌드 비용 증가 → Object Storage 전환 시점 모니터링 필요.
- 문서 후속: CLAUDE.md 서비스 표(game feature 를 code-dictionary 행에 병기), kafka-convention 토픽 표,
  code-dictionary/CLAUDE.md Modules 표 갱신 — 구현 시 반영.
