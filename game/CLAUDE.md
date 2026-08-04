# Game Service (게임 플랫폼)

CrazyGames 모델의 웹 게임 플랫폼 — 게임 카탈로그(태그/큐레이션/평점) + 플레이 세션 + 광고(후속 페이즈).
신규 JVM 없이 **`code-dictionary:app` 에 폴드**된 모듈러 모놀리스 라이브러리다 (ADR-0059, ADR-0058 컨벤션).

## Modules

| Gradle path | 역할 |
|---|---|
| `:game:sim` | **KMP 결정적 sim-core** (jvm: Tier B 리플레이 검증 / js: 브라우저 플레이). Snake + **몬스터 배틀 코어**(`sim.battle`). 루트 `subprojects` 의 kotlin.jvm 일괄 적용에서 카브아웃 (#23 흡수) |
| `:game:domain` | Pure Kotlin 도메인 (catalog, play, **arcade**) |
| `:game:feature` | 라이브러리(비-bootable) — 컨트롤러·서비스·JPA·Kafka + 전용 datasource(`game_db`)/EMF/TM/Flyway + **arcade Redis 저장소** |
| `:game:web` | Kotlin/JS 브라우저 클라이언트(Snake). 산출물은 portal-fe `public/games/snake/` 로 복사해 서빙 (#23 흡수) |

## Commands

```bash
./gradlew :game:domain:test              # 도메인 테스트 (Spring context 없음)
./gradlew :game:feature:test             # 서비스 단위(MockK) + 스키마 통합(Testcontainers MySQL)
./gradlew :game:feature:build            # feature 라이브러리 빌드
./gradlew :code-dictionary:app:build     # 호스트 앱 빌드 (game 포함)
```

> `GameSchemaIntegrationSpec` 은 실제 MySQL 로 Flyway 적용 + `ddl-auto=validate` 매핑 검증 +
> Querydsl 정렬/태그/유사게임 SQL 을 확인한다 (Docker 없으면 skip).

## Architecture (ADR-0059)

- 배치: `game:feature` → `code-dictionary:app` 마운트. 재분리는 ADR-0058 체크리스트 4단계 (feature·DB·토픽 무변경)
- 영속성: MySQL `game_db` 스키마 격리 + **전용 Flyway** (`GameFlywayMigrator`, `classpath:gamedb/migration` — 호스트 기본 Flyway 의 `db/migration` 재귀 스캔과 충돌 방지). 토글은 `game.flyway.enabled`, EMF 는 `@DependsOn("gameFlyway")` 로 마이그레이션 선행을 보장
- 트랜잭션: `@Transactional(transactionManager = "gameTransactionManager")` 필수 (기본 TM 은 code-dictionary 소유)
- Querydsl: `@Qualifier("gameJpaQueryFactory")` (기본 `jpaQueryFactory` 는 code-dictionary EMF 바인딩)
- Kafka: `game.session.started` / `game.session.ended` 발행 (수신: analytics, fire-and-forget). 발행은 트랜잭션 밖 (GamePlayService 파사드 / GamePlayCommand 분리)
- FE: portal-fe `/games/*` lazy route. INTERNAL_ROUTE 게임은 portal-fe 퀴즈 컴포넌트 재사용, IFRAME 게임은 entry_url 임베드

## Domains

| 도메인 | 설명 |
|---|---|
| catalog | Game(상태머신 DRAFT→REVIEW→BETA→PUBLISHED⇄SUSPENDED, `isMonetizable`=PUBLISHED+SDK, **genre 단일 대표 장르**), GameTag(+map), GameStats(1:1 프로젝션), GameCollection(MANUAL/TRENDING/NEW/TAG_BASED) |
| play | GamePlaySession(게스트 허용), GameRating(1인 1표, 1~10), **GameSaveData**(불투명 JSON + @Version 낙관적 락 + 64KB 상한 + Redis 디바이스 리스 1h), **GameRun**(서버 권위 시드 발급/소모 — 세이브스커밍 방어) |
| battle | `game:sim` 의 결정적 1v1 턴제 배틀 코어(타입 상성/STAB/Mulberry32) — BattleRunner 리플레이 재실행으로 Tier B 검증 가능. 몬스터 수집 RPG 프로토타입 기반 |
| ads | AdPlacement(HOUSE 크리에이티브 JSON)/AdPolicy(frequency SSOT, 판정은 Redis TTL)/RewardGrant(멱등 보상 원장 — PENDING→COMPLETED, 중복 콜백 1회 보장). rewarded 발급은 `isMonetizable` 게이트. 외부 네트워크(AdSense/GAM)는 후속 |
| arcade | #23 흡수분 — 세션 토큰(HMAC) · 리플레이 제출 · **Tier A/B 검증**(서버가 결정적 sim 을 재실행해 점수 위조 거부) · Redis 리더보드/데일리 챌린지. API 는 `/api/v1/games/arcade/**` |

## API Endpoints (요약)

| Prefix | 설명 |
|--------|------|
| `GET /api/v1/games` (+`?tag=&sort=trending\|new\|top`) | 공개 리스트 (PUBLISHED 만) |
| `GET /api/v1/games/collections`, `/tags` | 홈 큐레이션 행 / 태그 목록 |
| `GET /api/v1/games/{slug}`, `/{slug}/similar` | 상세(BETA 노출 허용) / 태그 교집합 유사 게임 |
| `POST /api/v1/games/{slug}/sessions`, `PATCH .../{sessionKey}` | 세션 시작(게스트 OK)/종료 |
| `PUT /api/v1/games/{slug}/rating` | 평점 upsert (X-User-Id 필수) |
| `GET/PUT /api/v1/games/{slug}/save` | 서버 세이브 — **게스트 허용** (V9). 로그인 사용자는 `X-User-Id`, 게스트는 서버 발급 12자리 **이어하기 코드**(`?code=` / body `code`)로 식별. PUT 은 `{data, version, code?}` 낙관적 저장, 신규 시 코드 발급. 읽기는 잠그지 않고 쓰기만 `X-Device-Id` 리스(1h) — 코드 제시 요청은 리스를 넘겨받는다(기기 분실 복구) |
| `POST /api/v1/games/{slug}/runs`, `GET .../{runKey}`, `POST .../{runKey}/consume` | 로그라이크 런 — 서버 시드 발급/조회/소모 (게스트 허용) |
| `POST/PUT /api/v1/admin/games/**` | 어드민 CRUD + 상태 전이 + 컬렉션 (ROLE_ADMIN) |
| `/api/v1/games/arcade/{catalog,sessions,scores,leaderboard,daily}` | #23 아케이드 — 세션 발급/점수 제출(검증)/리더보드. `games/**` 하위라 게이트웨이 라우트 추가 없음 |
| `GET /api/v1/ads/placements/{key}?subject=`, `POST /api/v1/ads/rewards`(+`/{key}/complete`) | HOUSE 배너 슬롯(cap 시 data=null) / rewarded 보상 발급·완료(멱등) |

게이트웨이 라우팅(`GatewayRouteConfig`)은 인증 수준별로 6개 라우트로 나뉜다 — 좁은 경로가 먼저
선언되어야 `games/**` 에 가려지지 않는다: `game-admin`(ADMIN) → `game-rating`(USER+) →
`game-save`(게스트 허용 + Rate Limiter — 익명 쓰기 방어) → `game-session`(게스트 허용, sessions+runs) →
`game-catalog`(공개) → `game-ads`(`/api/v1/ads/**`, 게스트 허용).

> CI 주의: game 모듈 변경은 `code-dictionary` 이미지 리빌드로 이어져야 한다 —
> `.github/workflows/images.yml` 의 `game/*` 경로 매핑 (ADR-0059 폴드).

## Key Rules

- 응답은 공통 `ApiResponse<T>` 포맷
- DRAFT/REVIEW/SUSPENDED 게임은 공개 API 에서 NOT_FOUND (존재 여부 은닉)
- GameStats 는 프로젝션 — 원본 이벤트 집계는 analytics(ClickHouse) 소유, 실시간 카운터를 Game row 에 두지 않는다
- `game:feature` 는 codedictionary 컨텍스트 빈을 직접 주입하지 않는다 (교차 import 금지, ADR-0058 불변식)

## Related

- ADR: `docs/adr/ADR-0059-game-platform.md`
- 설계(엔티티/ads 페이즈 포함): `docs/specs/2026-07-06-game-platform-entities-design.md`
- 시드: `game/feature/src/main/resources/gamedb/migration/V2__seed_internal_games.sql` (portal-fe 퀴즈 4종 등록)

## 정적 게임 자산 (#23 흡수)

캔버스 게임은 **portal-fe 정적 자산**으로 서빙한다 — 별도 nginx 파드를 만들지 않아 리소스 증가가 0이다.

| slug | 자산 | 비고 |
|---|---|---|
| `snake` | `portal-fe/public/games/snake/` | `./gradlew :game:web:jsBrowserDistribution` 산출물(game.js/index.html) 복사 |
| `overworld-quest` | `portal-fe/public/games/overworld-quest/index.html` | 단일 HTML(31KB, 외부 의존 0). 원본 파일명이 상표를 연상시켜 중립 명칭으로 등록 |

Snake 클라이언트를 고친 뒤에는 `jsBrowserDistribution` 을 다시 돌려 산출물을 복사해야 반영된다.
