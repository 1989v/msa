# Game Service (게임 플랫폼)

CrazyGames 모델의 웹 게임 플랫폼 — 게임 카탈로그(태그/큐레이션/평점) + 플레이 세션 + 광고(후속 페이즈).
신규 JVM 없이 **`code-dictionary:app` 에 폴드**된 모듈러 모놀리스 라이브러리다 (ADR-0059, ADR-0058 컨벤션).

## Modules

| Gradle path | 역할 |
|---|---|
| `:game:domain` | Pure Kotlin 도메인 (catalog, play) |
| `:game:feature` | 라이브러리(비-bootable) — 컨트롤러·서비스·JPA·Kafka + 전용 datasource(`game_db`)/EMF/TM/Flyway |

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
| catalog | Game(상태머신 DRAFT→REVIEW→BETA→PUBLISHED⇄SUSPENDED, `isMonetizable`=PUBLISHED+SDK), GameTag(+map), GameStats(1:1 프로젝션), GameCollection(MANUAL/TRENDING/NEW/TAG_BASED) |
| play | GamePlaySession(게스트 허용), GameRating(1인 1표, 1~10) |
| ads | **후속 페이즈** — AdPlacement/AdPolicy/RewardGrant 설계 완료 (spec §4.3), 미구현 |

## API Endpoints (요약)

| Prefix | 설명 |
|--------|------|
| `GET /api/v1/games` (+`?tag=&sort=trending\|new\|top`) | 공개 리스트 (PUBLISHED 만) |
| `GET /api/v1/games/collections`, `/tags` | 홈 큐레이션 행 / 태그 목록 |
| `GET /api/v1/games/{slug}`, `/{slug}/similar` | 상세(BETA 노출 허용) / 태그 교집합 유사 게임 |
| `POST /api/v1/games/{slug}/sessions`, `PATCH .../{sessionKey}` | 세션 시작(게스트 OK)/종료 |
| `PUT /api/v1/games/{slug}/rating` | 평점 upsert (X-User-Id 필수) |
| `POST/PUT /api/v1/admin/games/**` | 어드민 CRUD + 상태 전이 + 컬렉션 (ROLE_ADMIN) |

게이트웨이 라우팅(`GatewayRouteConfig`)은 인증 수준별로 4개 라우트로 나뉜다 — 좁은 경로가 먼저
선언되어야 `games/**` 에 가려지지 않는다: `game-admin`(ADMIN) → `game-rating`(USER+) →
`game-session`(게스트 허용 = `Config(required=false)`) → `game-catalog`(공개).

## Key Rules

- 응답은 공통 `ApiResponse<T>` 포맷
- DRAFT/REVIEW/SUSPENDED 게임은 공개 API 에서 NOT_FOUND (존재 여부 은닉)
- GameStats 는 프로젝션 — 원본 이벤트 집계는 analytics(ClickHouse) 소유, 실시간 카운터를 Game row 에 두지 않는다
- `game:feature` 는 codedictionary 컨텍스트 빈을 직접 주입하지 않는다 (교차 import 금지, ADR-0058 불변식)

## Related

- ADR: `docs/adr/ADR-0059-game-platform.md`
- 설계(엔티티/ads 페이즈 포함): `docs/specs/2026-07-06-game-platform-entities-design.md`
- 시드: `game/feature/src/main/resources/gamedb/migration/V2__seed_internal_games.sql` (portal-fe 퀴즈 4종 등록)
