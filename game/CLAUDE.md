# Game Service (게임 플랫폼)

대형 웹게임 포털 모델의 게임 플랫폼 — 게임 카탈로그(태그/큐레이션/평점) + 플레이 세션 + 광고(후속 페이즈).
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
- 영속성: MySQL `game_db` 스키마 격리 + **전용 Flyway** (`ScopedFlywayMigrator`(common), `classpath:gamedb/migration` — 호스트 기본 Flyway 의 `db/migration` 재귀 스캔과 충돌 방지). 토글은 `game.flyway.enabled`, EMF 는 `@DependsOn("gameFlyway")` 로 마이그레이션 선행을 보장
- 트랜잭션: `@Transactional(transactionManager = "gameTransactionManager")` 필수 (기본 TM 은 code-dictionary 소유)
- Querydsl: `@Qualifier("gameJpaQueryFactory")` (기본 `jpaQueryFactory` 는 code-dictionary EMF 바인딩)
- Kafka: `game.session.started` / `game.session.ended` 발행 (수신: analytics, fire-and-forget). 발행은 트랜잭션 밖 (GamePlayService 파사드 / GamePlayCommand 분리)
- FE: portal-fe `/games/*` lazy route. INTERNAL_ROUTE 게임은 portal-fe 퀴즈 컴포넌트 재사용, IFRAME 게임은 entry_url 임베드
- SEO (ADR-0062): 게임 페이지는 `portal-fe/scripts/prerender-seo.mjs` 가 빌드 후 공개 카탈로그 API 를 읽어 정적 HTML·sitemap 을 찍는다. **어드민으로 게임을 추가해도 portal-fe 재배포 전까지 프리렌더에 안 잡힌다.** `title_en`/`description_en`/래스터 썸네일(`thumbs/shots/*.png`)이 비면 영문 색인·소셜 카드가 비어버리므로 시드에서 채울 것

## Domains

| 도메인 | 설명 |
|---|---|
| catalog | Game(상태머신 DRAFT→REVIEW→BETA→PUBLISHED⇄SUSPENDED, `isMonetizable`=PUBLISHED+SDK, **genre 단일 대표 장르**), GameTag(+map), GameStats(1:1 프로젝션), GameCollection(MANUAL/TRENDING/NEW/TAG_BASED) |
| play | GamePlaySession(게스트 허용), GameRating(1인 1표, 1~10), **GameSaveData**(불투명 JSON + @Version 낙관적 락 + 64KB 상한 + Redis 디바이스 리스 1h), **GameRun**(서버 권위 시드 발급/소모 — 세이브스커밍 방어) |
| battle | `game:sim` 의 결정적 1v1 턴제 배틀 코어(타입 상성/STAB/Mulberry32) — BattleRunner 리플레이 재실행으로 Tier B 검증 가능. 몬스터 수집 RPG 프로토타입 기반 |
| ads | AdPlacement(HOUSE 크리에이티브 JSON)/AdPolicy(frequency SSOT, 판정은 Redis TTL)/RewardGrant(멱등 보상 원장 — PENDING→COMPLETED, 중복 콜백 1회 보장). rewarded 발급은 `isMonetizable` 게이트. 외부 네트워크(AdSense/GAM)는 후속 |
| arcade | #23 흡수분 — 세션 구슬(HMAC) · 리플레이 제출 · **Tier A/B 검증**(서버가 결정적 sim 을 재실행해 점수 위조 거부) · Redis 리더보드/데일리 챌린지. API 는 `/api/v1/games/arcade/**` |

## API Endpoints (요약)

| Prefix | 설명 |
|--------|------|
| `GET /api/v1/games` (+`?tag=&sort=trending\|new\|top`) | 공개 리스트 (**PUBLISHED + BETA** — 플레이 가능한 상태만) |
| `GET /api/v1/games/collections`, `/tags` | 홈 큐레이션 행 / 태그 목록 |
| `GET /api/v1/games/{slug}`, `/{slug}/similar` | 상세(BETA 노출 허용) / 태그 교집합 유사 게임 |
| `POST /api/v1/games/{slug}/sessions`, `PATCH .../{sessionKey}` | 세션 시작(게스트 OK)/종료 |
| `PUT /api/v1/games/{slug}/rating` | 평점 upsert (X-User-Id 필수) |
| `POST /api/v1/games/{slug}/scores`, `GET .../leaderboard?track=&limit=&period=&date=` | 랭킹 제출/조회 (게스트 OK). `period=ALL_TIME\|DAILY`, 생략 시 ALL_TIME — 게임 안 위젯(`lib/rank.js`)이 부르는 계약이 그것이다. `date` 는 DAILY 전용이고 생략 시 **KST 오늘** |
| `GET /api/v1/games/leaderboards?boards=&entries=` | 허브 레일용 배치 — 기록 있는 보드의 TOP N + **오늘 기록(`todayEntries`)**을 한 응답에 |
| `GET/PUT /api/v1/games/{slug}/save` | 서버 세이브 — **게스트 허용** (V9). 로그인 사용자는 `X-User-Id`, 게스트는 서버 발급 12자리 **이어하기 코드**(`?code=` / body `code`)로 식별. PUT 은 `{data, version, code?}` 낙관적 저장, 신규 시 코드 발급. 읽기는 잠그지 않고 쓰기만 `X-Device-Id` 리스(1h) — 코드 제시 요청은 리스를 넘겨받는다(기기 분실 복구) |
| `POST /api/v1/games/{slug}/runs`, `GET .../{runKey}`, `POST .../{runKey}/consume` | 로그라이크 런 — 서버 시드 발급/조회/소모 (게스트 허용) |
| `GET/POST/PUT /api/v1/admin/games/**` | 어드민 CRUD + 상태 전이 + 컬렉션 (ROLE_ADMIN). `GET`(목록 `?q=&status=&genre=&tag=&sort=created\|updated\|title\|playCount`, 상세)은 **상태 무관** — 공개 API 로는 보이지 않는 DRAFT/REVIEW/SUSPENDED 를 백오피스에서 다룬다. 화면은 admin-fe `/games` |
| `/api/v1/games/arcade/{catalog,sessions,scores,leaderboard,daily}` | #23 아케이드 — 세션 발급/점수 제출(검증)/리더보드. `games/**` 하위라 게이트웨이 라우트 추가 없음 |
| `WS /ws/games/{slug}` | 온라인 대전 릴레이 (raw WebSocket, 게스트). 아래 "온라인 대전 릴레이" 참조 |
| `GET /api/v1/ads/placements/{key}?subject=`, `POST /api/v1/ads/rewards`(+`/{key}/complete`) | HOUSE 배너 슬롯(cap 시 data=null) / rewarded 보상 발급·완료(멱등) |

게이트웨이 라우팅(`GatewayRouteConfig`)은 인증 수준별로 7개 라우트로 나뉜다 — 좁은 경로가 먼저
선언되어야 `games/**` 에 가려지지 않는다: `game-admin`(ADMIN) → `game-rating`(USER+) →
`game-save`(게스트 허용 + Rate Limiter — 익명 쓰기 방어) → `game-session`(게스트 허용, sessions+runs) →
`game-catalog`(공개) → `game-relay-ws`(`/ws/games/**`, 게스트 허용) → `game-ads`(`/api/v1/ads/**`, 게스트 허용).

## 온라인 대전 릴레이 (`com.kgd.game.infrastructure.ws`)

`/ws/games/{slug}` — raw WebSocket + JSON 한 줄. STOMP 미사용(구독 토픽·프레임 헤더가 불필요하고
게임 클라이언트가 단일 HTML 이라 stomp.js 의존을 얹지 않는다).

| 방향 | 메시지 |
|---|---|
| C→S | `{"t":"join","room":"<code>\|null","nick":"…"}` · `{"t":"move","d":{…}}` · `{"t":"leave"}` · `{"t":"ping"}` |
| S→C | `{"t":"joined","room":"ABC123","seat":0}` · `{"t":"start","seed":123,"players":["…","…"]}` · `{"t":"move","seat":1,"d":{…}}` · `{"t":"opponentLeft"}` · `{"t":"error","code":"…"}` · `{"t":"pong"}` · `{"t":"ping"}`(유휴 확인) |

- **권위 없는 릴레이** — `move` 의 `d` 는 열어보지 않고 상대에게 그대로 전달한다. 규칙 검증이 필요한
  종목이 생기면 그 종목 전용 권위 레이어를 릴레이 위에 따로 얹는다
- 매칭: `room` 지정 시 그 코드로 get-or-create(친구 초대), `null` 이면 같은 슬러그 대기열 자동 매칭
- 상한: 메시지 4KB · 20 msg/s(초과 시 close) · 동시 방 200 · 유휴 60초 ping / 90초 종료
- 방 상태는 **in-memory**(ConcurrentHashMap) — 단일 노드 · 호스트 1 레플리카 전제. 레플리카를 늘릴 때
  방 코드 sticky routing 또는 Redis pub/sub 을 넣는다 (지금 넣으면 구독자가 자기 자신뿐)
- 다른 게임 온라인화: 서버 변경 0 — 클라이언트가 `/ws/games/<slug>` 로 붙어 `d` 스키마만 정하면 된다

> CI 주의: game 모듈 변경은 `code-dictionary` 이미지 리빌드로 이어져야 한다 —
> `.github/workflows/images.yml` 의 `game/*` 경로 매핑 (ADR-0059 폴드).

## Key Rules

- 응답은 공통 `ApiResponse<T>` 포맷
- DRAFT/REVIEW/SUSPENDED 게임은 공개 API 에서 NOT_FOUND (존재 여부 은닉)
- **공개 목록은 플레이 가능한 상태(PUBLISHED·BETA)를 싣는다.** BETA 를 빼면 베타 게임을 아무도 못 찾아
  피드백을 받을 수 없다. 수익화는 상태와 별개로 `Game.isMonetizable()`(PUBLISHED + SDK)이 막는다.
  FE 는 `isBeta()`(status=BETA 또는 `beta` 태그)로 배지를 렌더한다 — 두 신호를 다 받는 이유는
  V35 가 PUBLISHED + 태그 방식으로 먼저 붙였기 때문이다
- **랭킹 보드의 축은 둘이다 — 트랙(무강화/강화, V28)과 기간(전체/오늘, V49).** 오늘 보드는
  `game_score` 에서 파생할 수 없어 별도 원장(`game_score_daily`)을 쓴다: 역대 보드는 닉네임당
  최고 1행이라 **자기 최고를 못 넘은 런은 아예 저장되지 않는다** — `updated_at` 이 오늘인 행을
  세면 "오늘 자기 기록을 깬 사람"만 세어진다. 하루의 경계는 **KST**(`GameDay.ZONE`)이고
  날짜는 서버가 정한다(클라이언트가 보내면 기기 시계만큼 보드가 갈린다). 제출 한 번이 두 보드를
  한 트랜잭션에서 올리며, **두 보드의 판정은 독립**이다
- **새 마이그레이션을 붙이기 전에 최신 번호를 확인한다.** 여러 세션이 한 워킹트리를 쓰기 때문에
  같은 번호를 동시에 잡는 일이 실제로 났다(`V49__game_score_daily` ↔ `V49__seed_marble_race`).
  버전이 겹치면 Flyway 는 **마이그레이션을 세는 단계에서 기동을 거부**하고, 그러면 테스트 게이트가
  죽어 **그 커밋의 모든 서비스 이미지가 안 만들어진다** — 게임 하나 때문에 전 서비스 배포가 멈춘다.
  겹친 걸 뒤늦게 발견했다면 **운영 `flyway_schema_history` 를 먼저 조회**해서, 아직 적용되지 않은
  쪽만 옮긴다(적용된 것을 건드리면 체크섬 불일치로 서비스가 죽는다)
- **`DECIDER`(순서 정하기) 장르는 분류가 아니라 기능이다.** 허브의 「랜덤으로 돌리기」가
  `GET /api/v1/games?genre=DECIDER` 로 뽑기 대상을 만들기 때문에, 이 장르로 등록하면 새 게임이
  **코드 수정 없이** 뽑기에 들어간다. 대신 등록 전에 둘을 지켜야 한다 — ① `lib/party.js` 인계를
  읽어 참가자·방식이 정해진 채로 바로 시작할 것 ② **출발 위치 ↔ 도착 등수 스피어만 |ρ| < 0.1**
  (dev 훅으로 재고 설계 문서에 수치를 남긴다). 상세 계약은
  `docs/standards/game-cleanroom-pipeline.md` 의 `party-decider` 프리셋 §7
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
| `overworld-quest` | `portal-fe/public/games/overworld-quest/index.html` | 단일 HTML, 외부 의존 0. 원본 파일명이 상표를 연상시켜 중립 명칭으로 등록 |
| `monster-tamer` `depth-delver` `outlaw-frontier` `gate-holdout` `gear-bastion` `iron-vanguard` `ember-temple` `frost-outpost` `echo-duel` | `portal-fe/public/games/<slug>/index.html` | 단일 HTML 자체 완결 게임 9종 (V7~V13 시드). 이어하기 코드 세이브 공용. `echo-duel` 은 **온라인 대전 모드** 보유 — 릴레이 첫 적용작 |
| `golden-forge` `rune-merge` `cave-glide` `wall-breaker` | `portal-fe/public/games/<slug>/index.html` | 캐주얼 팩 4종 (V16 시드). 방치형/2048 머지/원버튼/벽돌깨기 |
| `frost-outpost` (협동) | `portal-fe/public/games/frost-outpost/index.html` | 온라인 릴레이 세 번째 적용작 — **2인 협동**(건설 A / 지휘 B). 동기화는 **host authority**(seat 0 이 시뮬 소유, 10Hz 스냅샷 + 체크섬, 게스트는 의도만 전송): 기존 싱글 시뮬이 가변 dt + 부동소수 math 라 lockstep 은 그 코드를 다시 써야 하고 그게 곧 싱글 회귀 위험이었다. 상대 이탈 시 게스트가 권한을 승계해 진행 손실 없이 솔로 계속. **협동 기록은 랭킹 제외**(생존 초 단일 스칼라라 두 밸런스 곡선이 섞인다) |
| `crimson-ravine` `storm-corridor` `dice-citadel` `rift-front` | `portal-fe/public/games/<slug>/index.html` | 유즈맵 팩 2차 (V18 시드). 오토배틀/탄막 회피/랜덤 머지 디펜스/미니 AoS — 세이브 없음, 랭킹+재도전만 |
| `word-warden` `quad-weave` `pixel-mine` `royal-grid` `number-garden` | `portal-fe/public/games/<slug>/index.html` | 데일리 퍼즐 팩 (V19 시드). 한글 워들/Connections/노노그램/퀸 배치/스도쿠 — KST 날짜 시드(`lib/daily.js`), 스트릭+이모지 공유, 유일해 클라이언트 생성(퀸 배치는 변이 수리, 스도쿠는 파기 검증). 썸네일은 `thumbs/daily/*.svg` |
| `block-burst` `crate-shift` `mine-pioneer` `stone-sage` `rope-works` `acid-rain` `word-chain` `bracket-battle` `abyss-drill` `cog-foundry` `hero-dispatch` `starlight-farm` `alley-pool` `breeze-links` `beat-dojo` `dawn-ward` `serpent-legion` | `portal-fe/public/games/<slug>/index.html` | 확장 팩 1차 17종 (V20 시드). 퍼즐/보드·한국 특화(타자·끝말잇기)·방치형·물리 스포츠·리듬·서바이버. 썸네일은 `thumbs/art/*.svg`. 방치형(`abyss-drill` `hero-dispatch` `starlight-farm`)은 golden-forge 와 동일한 이어하기 코드 세이브. `bracket-battle` 만 랭킹 미사용(결과 공유형, `sdk_integrated=0`) |
| `midnight-tide` `spud-arena` `hand-alchemy` `element-pilgrim` `relic-heir` `cliff-climber` `moon-angler` | `portal-fe/public/games/<slug>/index.html` | 확장 팩 2차 7종 (V21 시드) — 히트 장르 집중. 서바이버 2종(오브젝트 풀 + 공간 해시로 적 300+ 처리), 카드 로그라이크 2종, 인크리멘탈 로그라이트, 피켈 물리 등반, 릴 파이트 낚시. `relic-heir` `moon-angler` 는 이어하기 코드 세이브 |
| `sketch-sleuth` | `portal-fe/public/games/sketch-sleuth/index.html` | 온라인 그림 맞추기 (V24 시드). 릴레이 두 번째 적용작 — 붓질을 정수 격자 양자화 + 델타 인코딩 + 120ms 배칭으로 보내 상한(4KB·20msg/s) 안에 유지(실측 피크 10msg/s·최대 101B). 릴레이가 규칙을 모르므로 **매 라운드 그리는 쪽이 심판**을 겸한다 |
| `nether-return` | `portal-fe/public/games/nether-return/` (**다중 파일 + 에셋**) | 로그라이크 액션 RPG (V29 시드, PC 우선 1280×720). 유일하게 **외부 CC0 에셋**(0x72 DungeonTilesetII + 네오둥근모 폰트, `assets/CREDITS.md`)을 쓴다. 대시 무적·문 보상 예고(pending reward)·신격 문장 24종(염라/바리/강림/마고)·3계층+보스 3종·**런 이어하기**(중단 저장→복원)·예언 목록·허브 대사. 세이브는 GameSaveData(단일 그릇에 메타+런+예언), 시드는 GameRun, 랭킹 BASE/MODDED. 설계 원본: `docs/specs/2026-08-13-nether-return-design.md` |
| `abyssal-crown` | `portal-fe/public/games/abyssal-crown/` (**다중 파일**) | **클린룸 1호 · 신규 품질 마지노선** (V30 시드). 로그라이크 액션 — 2560×1440 절차 벡터, JS 16모듈 10K줄, 축복 26종·보스 3종(3페이즈), 신스 BGM. 통합은 `lib/platform.js`(랭킹+세이브 동기화). 설계: `docs/specs/2026-08-14-abyssal-crown-design.md` |
| `raging-fist-saga` | `portal-fe/public/games/raging-fist-saga/` (**다중 파일**) | **클린룸 2호** (V30 시드). 벨트스크롤+대전격투 커맨드 — 스켈레톤 리그→15비트 양자화 베이크, 모션 커맨드 4종+초필 2종(캔슬·입력버퍼 6F), 스테이지 3+히든 1, 숨김 요소 5종. 통합은 `lib/platform.js`. 설계: `docs/specs/2026-08-14-raging-fist-saga-design.md` |
| `nova-strike` | `portal-fe/public/games/nova-strike/` (**다중 파일**) | **클린룸 3호** (V32 시드). 32비트 세대 런앤건 액션 플랫포머 — **플레이어블 2인**(건슬링거 더스크: 리볼버+차지 매그넘 / 검객 레이븐: 3연 콤보+강참·회전참, 스페이스 웨스턴 오리지널 디자인). 640×360 정수 배율, 리그 베이크 스프라이트+자동 외곽선/림라이트, 대시·월점프·보스 무기 3종 약점 순환, 4지역(용암 추격/빙판/상승기류/최종 2형태 보스) + 숨김 요소 + 코어 칩 상점. 한국어 UI 는 고해상 오버레이 캔버스. 통합은 `lib/platform.js`. 설계: `docs/specs/2026-08-15-nova-strike-design.md` |
| `ashen-warband` | `portal-fe/public/games/ashen-warband/` (**다중 파일**) | **클린룸 4호** (V34 시드). **2인 로컬 협동** 아케이드 벨트스크롤 액션 RPG — 8층 + 4층 분기 2갈래 + 엔딩 3종, 층 보스 8 + 중간보스 8, 적 22종, 히든 26, 비전투 구간 17종(기믹 5 + 층 전용 8 + 탐색 3 + 야영). 클래스 4종의 **방어기 성격이 서로 다르다** — 지속형(방패막기·가드 브레이크) / 타이밍형(패링 8프레임 → 완전무효+반격) / 투사체 특화형(쳐내기 → 반사) / 자원 흡수형(실드 흡수 게이지). 모션 커맨드 + **금화로 사는 추가 기술** + 공중 저글 + 컷인 필살. **보스는 패턴마다 정답이 다르다**(점프/붙기/측면/가드·패링/스턴 유발/쳐내기), 예고를 형태·색·소리 3중으로 분리. CONTINUE(아케이드 문법, 점수 ×0.5). **2인 모드에서 키 배열이 좌/우로 동적 분리**된다(1P 방향키+`J K L ; '` / 2P WASD+`F G H V B`). 세이브는 **층 경계**에서 `localStorage['ashen-warband.save']` 단일 키(약 400B) → platform.js 가 서버 동기화. 랭킹 스칼라는 `world.totalScore`. 2560×1440, 코드 11,600여 줄, 에셋은 OFL 서체 2종뿐. 설계: 게임 폴더의 `DESIGN.md` |
| `curfew-siren` | `portal-fe/public/games/curfew-siren/` (**다중 파일**, ES module) | **클린룸 5호** (V37 시드, **베타** — V35 방식 그대로 `status=PUBLISHED` + `beta` 태그 + `sdk_integrated=0`. `GameStatus.BETA` 는 `PUBLIC_STATUSES={PUBLISHED}` 때문에 공개 목록에서 빠져 피드백을 못 받는다). **뷰가 2벌인 이원 구조** — 낮은 쿼터뷰 생존 파밍(`iso-scavenge` 프리셋), 밤은 아케이드 벨트스크롤(`arcade-beltscroll` 프리셋). 낮→밤은 **사이렌 연출 1회로 로딩 없이** 이어지고 무기·부상·감염이 그대로 이월된다. 두 뷰가 "게임 두 개" 로 보이지 않게 팔레트·UI 문법·캐릭터 리그·사운드·폰트·배경 레이어 문법(6층 파랄랙스)을 **공유**하는 게 최상위 불변식 — `js/art/` 와 `js/game/{state,base,specs}` 가 day/night 바깥에 공통으로 있다. 낮: 시야 원뿔 + **기억 2단계**(`seen 1`=지면만 / `2`=내용물까지 — 시작 반경 9타일은 지면만 열어 첫인상을 고치되 좀비·컨테이너는 계속 숨긴다) + **소음 예산**(걷기<수색<달리기<문부수기, 임계 100 → 3.2초 예고 후 호드 4기) + 부피 가방 26 + 자원 인과 제작. 밤: 약공 4단 체인·공중 저글·모션 커맨드·구매형 기술·클래스별 방어기 4종·컷인 필살. **생존 층**: 부위별 감염 시계(**유일한 치사 시계**), 허기(하한 25% + 공격력 페널티 — 바닥 없이 깎으면 부활 무한 루프가 된다), 부위 부상, 무기 내구도, 거점 인구 = 자원이자 리스크. 세이브 `localStorage['curfew-siren.save.v1']` → platform.js 서버 동기화, 랭킹 스칼라는 플레이어 `score` 합계. 2560×1440, 코드 9,600여 줄. **현재 수직 슬라이스(스테이지 1 + 중간보스)까지** — 스테이지 2~8·층 보스·탈것·동행 AI·합체 필살·밤 히든은 미구현. 설계: `docs/specs/2026-08-17-curfew-siren-design.md` |
| `deadline` | `portal-fe/public/games/deadline/` (**다중 파일**, ES module) | **클린룸 6호** (V36 시드 · V39 개명, **status=BETA**). 옛 슬러그 `rustveil-holdout`(옛 이름 「녹빛 봉쇄구역」) — 구 URL 은 App.tsx 가 새 슬러그로 리다이렉트한다. 쿼터뷰 좀비 생존·건설·디펜스 — 파밍→제작→건설→밤 방어 루프. **세계가 11×11 = 121구역**(34,400×25,600, 다섯 겹 고리)이고 지역 26종 중 8종은 건물 없는 자연 지형. **구역이 곧 청크**라 지도(종류·고리·랜드마크 위치)만 처음에 정하고 내용물은 다가갈 때 한 프레임에 한 구역씩 만든다 — 렌더·충돌·조회가 전부 보이는 구역만 훑는다. 고리 경계의 검역 봉쇄선이 시대로 열려 **새 시대 = 새 지형 한 겹**. 탐험 보상은 랜드마크 16종(중계탑=이동 거점·강도 야영지·보급 잔해·자원 노다지)과 안개 세계지도(`M`). 적은 **두 세력** — 감염체 23종(행동 축이 전부 다름)과 강도 7종(사격·도주·창고 약탈·야영지·낮 습격). 셋이 서로 싸운다. 무기 5종(근접/권총/기관단총/산탄/소총), 구조물 82종, 레시피 156종, 시대 6단계, 100시간 생존 카운터. 2인 로컬 협동(키 좌/우 분할, 이격 제한 1500). 세이브 `deadline.save.v1` 외 2키(구 `rustveil.*` 키를 1회 흡수) → platform.js 서버 동기화, 랭킹 스칼라는 밤·시대·탐사 가중합. 스프라이트 굽기는 **(클립 × 방향) 조각 단위**로 프레임당 하나씩 — 통째로 구우면 첫 조우마다 140~380ms 멈춘다(실측). 2560×1440, 45모듈 12,700여 줄, 외부 에셋 0. 설계: `docs/specs/2026-08-17-deadline-design.md` |
| `aero-vendetta` | `portal-fe/public/games/aero-vendetta/` (**다중 파일**) | **클린룸 7호** (V44 시드). 종스크롤 아케이드 슈팅 — **랭킹이 1급 시민**: 메달 체인(연속 회수 100→10000, 놓치면 리셋)·V편대 격멸·노미스 20000·보스 부위 파괴 +5000·스테이지 메달 결산으로 점수를 쌓는다. 3전장(군도 해역/밀림 협곡/요새 도시 — 지형 생성기가 실제로 다름) + 다단 페이즈 보스 3기(부위 파괴·레이저 스윕·포탑 그리드) + 중간보스 2 + 적 14종 + 히든 4종(보급창 메달 소나기·비밀 UFO·은닉 1UP·편대 보너스). 기체 3종(팔콘/호넷/콘도르)은 **누적 메달로 해금**(죽어도 남는 메타). 피탄 판정 r12(기체보다 작게)·필살 폭격(지속 4.5s 무적+탄막 연속 소거 — 못 피할 때 긋는 버튼)·클램프 가변 스텝(120Hz 대응). 로컬 top10(이니셜 3자) + `PlatformAdapter.runEnd` 서버 랭킹, 세이브 `av_save` 단일 키 동기화. 모바일 가상패드 배선·실측 완료(`supports_mobile=1`). 1080×1440 세로, 7모듈 3,300여 줄, 외부 에셋 0(그래픽·BGM 전부 절차 생성). 설계: `docs/specs/aero-vendetta-DESIGN.md` |
| `coin-corgi` | `portal-fe/public/games/coin-corgi/` (**다중 파일**) | **클린룸 8호** (V45 시드). 장르 프리셋 **`casual-catch` 의 첫 산출물** — 한 판 40~90초짜리 낙하물 받기·피하기 팝콘 아케이드. **이 장르의 정체성은 판정 비대칭**이다: 보상은 시각 접촉보다 먼저 먹히고(코기 +18px) 피해는 더 겹쳐야 맞는다(+20px) — "닿을 것 같은데 안 먹힌 / 안 닿았는데 맞은" 실측 0. **판정 폭은 상수가 아니라 `Art.dogMetrics()` 가 돌려주는 "그려지는 반폭"에서 유도한다**(보상 ×1.22 / 피해 ×0.83 / 벽 클램프 ×1.0) — 상수로 박으면 몸이 긴 스킨에서 그림과 판정이 어긋난다(닥스훈트는 반폭이 코기의 1.24배인데 같은 상수로 돌아 옆구리에 닿아도 안 먹혔다). **스케일은 이름값이 아니라 그려지는 픽셀로 잰다** — 1차 리그는 `P.h`=150(화면 1/9.6)이라 스펙 안인 줄 알았는데 실제 그려진 높이가 227px(1/6.3)로 넘쳐 있었다. 현재 164×151(1/9.5). 웅크리기는 그 비대칭을 플레이어가 직접 조절하는 장치(피해 판정↓ 보상 판정도↓ 이동 42%). 낙하물 8종 — 동전/지폐/**금괴(항상 똥 2개를 ±132px 에 대동해 리스크-리워드를 강제)**/똥/**벌(0.9초 삼각형 예고 후 수평 유도, 짖기로 격퇴)**/뼈다귀(자석)/우산(실드)/하트. 조작 5종(이동·점프·웅크림·대시·**짖기** — 짖기는 벌 격퇴 + 똥 밀어내기 + 보상 흡인 3역, 마지막이 없으면 "짖으면 손해"가 되어 아무도 안 쓴다). 존 3종(햇살 공원/노을 골목/네온 옥상)이 34초마다 배경·팔레트·**BGM째** 교체, 티어는 15초마다(**점수가 아니라 시간 기준** — 점수 기준이면 잘하는 사람만 어려워져 곡선이 뒤집힌다), 이벤트 2종(돈벼락 — **배너가 약속한 대로 화면의 위험물을 실제로 소거한다** / 비둘기 습격). 메타는 누적 획득액으로 견종 3종 해금 — **색 스킨이 아니라 리그가 다르다**(다리 0.24~0.40 · 몸 0.94~1.34 · 선귀/뾰족귀/늘어진귀 · 뭉툭/말림/가는 꼬리). 캐릭터는 1차에 "튜브에 머리 얹은" 실루엣으로 나와 사용자 반려 → 치비 비율(머리:몸통 폭 0.47→0.63)·배(pear) 몸통·복슬 가슴털·큰 눈+눈두덩·볼터치로 재작성. **6축 게이트가 전부 통과했는데도 귀엽지 않았다** — 캐릭터 매력은 그 축들이 못 잡는다. **죽은 입력 감사 120칸(4씬×30키) 전수 통과** — 이 감사가 음소거·재시작의 무음 반응 2건을 잡아냈다. 콘솔 메시지 0(148초 완주 회귀 후 포함), 119~125fps, 봇 무보정 생존 55.7초. 세이브 `coincorgi.*` 5키 동기화 + `PlatformAdapter.runEnd` 랭킹. 모바일 가상패드 배선·실측 완료(`supports_mobile=1`) — 이때 **lib/platform.js 랭킹 버튼이 lib/touch.js 액션 버튼과 우하단에서 겹치는 공용 결함**을 발견해 게임 CSS 로 우회했다(8개 게임 공통 문제). 1080×1440 세로, 7모듈 3,100여 줄, 외부 에셋 0. 설계: `docs/specs/2026-08-22-coin-corgi-design.md` |
| `sum-trail` | `portal-fe/public/games/sum-trail/` (**다중 파일**) | **클린룸 9호** (V46 시드). 장르 프리셋 **`grid-number-puzzle` 의 첫 산출물** — 7×7 숫자 격자를 이어 그어 제시된 합을 정확히 만드는 퍼즐. **확정 키가 없다** — 모든 카드 값이 1 이상이라 합이 목표와 같아지는 지점이 경로당 최대 한 번이고 그게 유일한 정지점이라 자동 확정한다. **이 장르의 1급 불변식은 "막힌 판을 만들지 않는 것"** — 목표를 난수로 뽑지 않고 `achievableSums()` 가 제한 깊이 DFS 로 훑은 "지금 판에서 실제로 만들 수 있는 합" 중에서만 고르며, **리필이 끝날 때마다 다시 검사**한다(실측: idle 31회 전수 검사 중 풀 수 없는 판 0회·셔플 0회). 목표 유형 3종(합 / 금지 숫자 / 홀짝)은 해 검사도 같은 제약으로 돌린다 — 제약을 걸어놓고 만들 수 없는 목표를 주면 불변식이 깨진다. 방해 타일 2종은 **반드시 반격 수단이 있다**(돌=인접 클리어 2회로 파괴·금이 붉게 변해 내구가 보인다 / 자물쇠=1회로 해제, **자물쇠 아이콘은 우하단 배지** — 가운데 두면 숫자를 덮어 "풀면 얼마가 되는지" 를 못 읽는다). **포인터가 1급 시민이지만 키보드로도 완전히 플레이된다**(드래그/방향키 각각 잇기·되짚기 취소). 관용 반경 = 셀 한 변의 0.62배. 점수 = 목표×12×길이×연속×유형. 죽은 입력 감사 120칸 전수 통과, 콘솔 0, 120fps. **모바일은 네이티브 터치 드래그 — `lib/touch.js` 가상패드를 붙이지 않는다**(얹으면 격자를 가린다). 1080×1440 세로, 6모듈 2,000여 줄, 외부 에셋 0. 설계: `docs/specs/2026-08-22-sum-trail-design.md` |
| `hoop-order` | `portal-fe/public/games/hoop-order/` (**다중 파일**) | **클린룸 10호** (V47 시드). 장르 프리셋 **`sort-puzzle` 의 첫 산출물** — 섞인 색 고리를 기둥 사이로 옮겨 색깔별로 정리하는 턴제 퍼즐. **제한 시간이 없다**(이 장르에 초시계를 붙이면 생각할 시간을 뺏어 장르가 무너진다) — 대신 실패 조건은 **되돌리기(판당 5회)를 다 쓴 상태에서 유효한 수가 0** 인 것이다. **해 존재는 솔버가 아니라 생성 방식으로 보장한다: 완성 상태에서 역으로 섞는다.** 여기서 실버그가 터졌다 — 역섞기 조건을 "정방향 규칙(같은 색 위에만)" 으로 걸면 **단색 스택이 영원히 단색이라 판이 아예 안 섞인다**(시작부터 `solved: true`). 올바른 조건은 **"이 역이동을 정방향으로 되돌릴 수 있는가"** 이고, **받는 쪽에는 제약을 걸지 않는다**. 같은 이유로 **목표 색 받침은 놓기 제한이 아니라 표시**다 — 놓기까지 막으면 역섞기 해답이 통과하지 못해 풀 수 없는 판이 된다. 검증은 저장한 역섞기 시퀀스를 뒤집어 **실제 `tap()` 으로 재생**해 6개 스테이지 전부 완성 확인(실패 0). **greedy 봇은 이 퍼즐을 829수에도 못 푼다** — 게임 버그가 아니라 봇 한계이므로 검증 봇은 해답을 따라가게 만들었다. 조작은 2탭 + 드래그 + 키보드 3종, 거절 시 **이유를 문장으로** 준다. 색맹 대응으로 고리마다 색과 함께 기호 9종을 새긴다. 한 줄 배치 · 기둥 최대 9개(터치 타깃 하한) · 기둥 길이 8~12칸. 죽은 입력 감사 120칸 전수 통과, 콘솔 0, 120fps. **모바일은 네이티브 터치 — 가상패드를 붙이지 않는다**. 1080×1440 세로, 6모듈 1,800여 줄, 외부 에셋 0. 설계: `docs/specs/2026-08-22-hoop-order-design.md` |
| `pixel-logic` | `portal-fe/public/games/pixel-logic/` (**다중 파일**) | **클린룸 11호** (V48 시드). 장르 프리셋 **`picture-logic` 의 첫 산출물** — 숫자 힌트만 보고 칸을 칠하면 그림이 드러나는 논리 퍼즐. **이 장르의 존재 이유는 완성 그림 하나다** — 난수 격자는 다 풀어도 아무것도 아니라 푸는 보람이 사라진다. 1차본은 격자에 손으로 `#` 을 찍었고 **연필이 종, 꽃이 돋보기, 나비가 네모**로 나와 사용자 반려. 그래서 그림을 **벡터 실루엣(도형 대수 — 타원·사각·다각형·굵은 선분의 더하기/빼기)** 으로 갖고 있다가 판 크기가 정해질 때 칸마다 4×4 로 훑어 **덮인 비율**로 굽는다(`shapes.js`+`raster.js`) — 사진을 줄여 픽셀아트로 만드는 것과 같다. 여기서 두 가지 하한이 나왔다: **획이 상자 긴 변의 0.09 미만이면 최소 판에서 사라지고**(튤립 줄기 0.035 → 15칸에서 0.4칸 → 증발), **붙어 있는 두 부분은 통짜로 뭉친다**(나비가 해골로 읽혔다) — 사이에 빈 줄 한 칸을 강제로 확보하고 그 안에 몸통을 다시 그려야 한다. **유일해는 백트래킹이 아니라 줄 단위 논리(가능한 배치의 교집합)로 전부 확정되는지**로 판정한다 — 찍어야 풀리면 복권이다. 안 풀리면 그림을 버리지 않고 **굵기(threshold) 후보 7개로 다시 구워** 통과하는 판을 찾는다(24그림 × 5티어 = **120조합 전부 통과**, 전수 검사 78ms). 대각선 띠는 굵기를 바꿔도 통째로 밀 수 있어 유일해가 안 나온다(연필을 눕혔더니 미확정 100칸). **그림은 완성해야 볼 수 있다** — 도감의 잠긴 칸은 실루엣도 안 보이고 물음표만, 타이틀 데모도 수집 대상이 아닌 전용 도형을 쓴다. 난이도는 정보를 숨기는 게 아니라 **판 크기**로 고른다(보통 15×15 / 어려움 20×20 / 전문가 25×25, 두 판마다 한 티어 상승, 그림 비율에 맞는 n×m 격자 선택). 실수는 즉시 위치를 알려주고 그 칸을 엑스로 확정해 남긴다(허용 2~3회). 죽은 입력 감사 95칸(5씬×19키) 전수 통과, 콘솔 0(플랫폼 save API 404 제외), 120fps. **모바일은 네이티브 터치 — 가상패드를 붙이지 않는다**(도구 버튼 124×44.4 CSS px). 1080×1440 세로, 9모듈, 외부 에셋 0. 설계: `docs/specs/2026-08-23-pixel-logic-design.md` |
| `marble-race` | `portal-fe/public/games/marble-race/` (**다중 파일**) | **클린룸 12호** (V51 시드 — 처음 V49 로 붙였다가 같은 번호를 쓴 `game_score_daily` 와 충돌해 옮겼다). 장르 프리셋 **`party-decider` 의 첫 산출물** — 커피 사는 사람 정하기처럼 여럿이서 뭔가 정할 때 쓰는 구슬 경주. **실력 게임이 아니라 도구라서 1급 목표가 재미가 아니라 공정성과 그 증명**이다: 구슬은 반지름·질량·반발계수·마찰이 전부 같고, 맵은 고정·좌우대칭이며, **출발 자리만 매 판 섞는다**(사람별 확률이 같아지는 지점). 무작위는 전부 시드 하나에서 나오고 물리는 **고정 1/240초**라 같은 시드면 같은 결과 — 시드를 화면에 띄우고 "같은 시드로 다시"를 줘서 **미리 정해 둔 게 아님을 사용자가 직접 확인**하게 한다(재현 시험 불일치 0, 균등성 χ²=3.4/5.85 vs 임계 11.07 @240판). **사행성 가드레일**: 돈·포인트 입력란 자체가 없고, 배당/당첨금 표현을 쓰지 않으며, 참가자 이름은 기기 밖으로 안 나간다(→ `PlatformAdapter` 미부착, 랭킹 없음, `sdk_integrated=0`). 물리는 외부 엔진 없이 자체 구현 — 원/캡슐 충돌 + **구름 마찰**(접촉점 속도는 `vt − ω·r`, 부호를 뒤집으면 5° 비탈에서 구슬이 선다) + 회전체 + 시소(접촉 토크로 기움) + 컨베이어. **이 장르의 사고는 전부 '판이 안 끝난다'로 나타나고 눈으로는 안 보인다** — 구슬 하나를 34개 x 지점에서 떨어뜨리는 **통과 시험**을 만들어 잡았다(비탈에 파묻힌 못=60초 정지 / 수평 칸막이 위에 서 버림 / 레일 쪽으로 기운 면이 만드는 주머니 / 비탈 간격 < 낙차+구슬지름 / 평평한 기둥 꼭대기). **반발계수 1.14 범퍼는 낀 구슬을 초속 3만 픽셀로 날려 보냈다** — 범퍼는 상한 있는 kick 으로 바꾸고 전역 속도 상한을 뒀다. 트랙은 4~5화면 길이(5.0~5.5K px)이고 **모든 코스가 마지막 관문으로 끝난다** — 범퍼 밭으로 한 번 흩고, 깔때기로 모으고, **폭 54px(구슬 지름+10)·길이 320px 좁고 긴 통로**를 한 줄로 지나간다. 입구 어깨 범퍼가 들어가려는 구슬을 튕겨 낸다. 여기가 결과가 확정되는 유일한 지점이라 가장 조마조마해야 한다(두 번의 사용자 피드백 반영). **카메라가 벤치마크의 남은 축이었다** — 선두 무리가 화면을 채우도록 가로·세로 퍼짐에서 줌을 역산하고(0.86~1.85배, 뒤처진 하나에 끌려가지 않게 **선두 60% 만** 센다), **다음 도착이 결과를 정하는 도착**일 때 그 구슬이 결승 480px 안에 들면 0.32배까지 느려진다. 카메라·배속은 그림만 바꾸므로 레이스 중에도 사용자 조작을 허용한다(↑↓ 화면 크게·작게, ←→ 느리게) — 조작을 막는 이유는 결과 보호이지 불편함이 아니다. **구제 장치는 아래로 치우쳐 밀어야 한다** — 위로 밀면 좁은 통로에 든 구슬을 도로 뱉어 통과 시험이 34/34→32/34 로 악화됐다. 코스 3종(핀볼/폭포/회전목마) x 조각 9종, 모드 4종(꼴찌·1등·N등·순서), 이름 뒤 `x3` 가중치. 한 판 22~42초. **출발은 한 통에 담아 쏟는다** — 화면 폭 전체에 한 줄로 세우면 코스가 섞을 일이 없어 출발 자리가 그대로 순위가 된다. 자리 배정을 시드로 섞어도 사람별 확률만 균등해질 뿐 눈에는 그대로 보인다. 지표는 **출발 x ↔ 도착 등수 스피어만 ρ** 이고, 한 줄 출발일 때 폭포가 **−0.27**, 한 통 출발로 바꾸니 **−0.014** 가 됐다(3코스 전부 |ρ|≤0.10). 통 바로 다음은 흩는 구간이어야 하고, 통 위에 카메라 여유 430px 이 없으면 통이 늘 화면 맨 위에 붙어 HUD 뒤로 들어간다. **화면 문구에 외래어 직역을 두지 않는다** — 씨앗/시드→**코드**(결과에선 **다시 보기 코드**), 슬로 모션→**느리게**, 줌 인/아웃→**화면 크게/작게**, 맵→**코스**, 모드→**방식**. 「판 번호」도 "이게 뭔 말이지" 로 반려됐다 — **무엇인지가 아니라 무엇에 쓰는지**로 불러야 한다(사용자 지시). 죽은 입력 감사 3씬 전수 통과, 120fps, 외부 에셋 0. 설계: `docs/specs/2026-08-23-marble-race-design.md` |
| `ladder-draw` | `portal-fe/public/games/ladder-draw/` (**다중 파일**) | **클린룸 13호** (V50 시드). 프리셋 **`party-decider` 의 두 번째 산출물** — 커피 사는 사람 정하기·역할 나누기·순서 정하기용 사다리타기. 같은 프리셋이지만 **증명 방식이 구슬 레이스와 반대**다: 판이 화면보다 작아 미니맵이 필요 없고, **가로줄을 처음부터 전부 보여 준 채로 시작**한다. 전부 보여 줘도 안전한 이유는 **무작위의 실체가 가로줄이 아니라 아래 항목 배치**라서다 — 줄을 눈으로 따라가도 몇 번 칸에 가는지만 알 뿐 거기 뭐가 있는지는 모른다. **일대일 대응은 구조가 보장한다**(가로줄 = 이웃 두 줄의 교환 → 순열): 12만 판에서 깨짐 0건. **그런데 사다리 자체는 균등하지 않다** — 가로줄이 유한하면 자기 자리 근처에 도착할 확률이 높다(실측 n=6 χ²=640, n=12 χ²=17,705). 사람별 확률을 균등하게 만드는 건 사다리가 아니라 **`shuffleEnds()` 한 줄**이고, 섞은 뒤 χ² 은 0.0~9.4 로 임계값 아래다. 대부분의 사다리 앱이 말해 주지 않는 부분이라 CREDITS 에 수치로 적어 뒀다. **1차 구현은 n=2 에서 1번이 100% 1번 칸이었다** — "빈 행이 없어야 사다리로 보인다" 며 모든 행에 가로줄을 강제했더니 세로줄 2개일 때 교환 횟수가 행 수로 고정돼 결과가 완전히 결정됐다. 지금은 행이 아니라 총량만 보정한다. 연출은 동시 하강(색 자취가 얽히는 게 그림)이고, 가로 이동 중에는 진행 방향으로 6px 어긋나게 그린다(반대 방향 두 줄이 정확히 겹쳐 하나로 보인다). **한 줄만 먼저 보기**(이름표 탭)와 **걸림을 마지막에 여는 공개 순서**가 이 게임의 긴장 장치다. 모드 3종(한 명이 걸린다·순서 정하기·항목 배정), 2~12명. 죽은 입력 감사 4상태×18키 전수 통과, 콘솔 0, 120fps, 버튼 157×44.4 CSS px, 외부 에셋 0. `PlatformAdapter` 미부착·랭킹 없음(`sdk_integrated=0`) — 이름과 나눌 항목은 실명·업무 내용이라 서버로 안 보낸다. 설계: `docs/specs/2026-08-23-ladder-draw-design.md` |
| `card-flip` | `portal-fe/public/games/card-flip/` (**다중 파일**) | **클린룸 14호** (V53 시드). 프리셋 **`party-decider` 의 세 번째 산출물** — 엎어 놓은 카드를 한 명씩 뒤집어 정한다. **이 게임의 심장은 남은 확률**이다: 여섯 장 중 한 장일 때는 아무렇지 않다가 두 장 남으면 손이 떨린다. 그래서 확률은 HUD 구석 숫자가 아니라 판 위쪽 큰 글자이고, 오를수록 노랑→빨강으로 가며 **심장 박동 소리가 같은 값을 따라 72→158 BPM 으로 빨라진다**. **의심받는 지점이 앞선 두 산출물과 다르다** — 사다리·구슬은 "맵이 결과를 정하느냐" 였지만 여기서는 **"먼저 뽑는 게 불리하냐"** 다. 답은 아니오이고 그게 반직관이라 수치로 반박한다: k 번째가 걸릴 확률은 앞 사람들이 피할 확률과 약분되어 정확히 1/n(실측 χ²=4.18 왼쪽부터 / 2.68 아무거나, 임계 11.07 @n=6 4천판). **고르는 방식도 따로 쟀다** — "왼쪽부터 뽑으면 손해" 라는 말이 실제로 나오기 때문이고, `Deck.simulate()` 가 고르는 방식을 인자로 받는 이유가 그것이다. 출발 편향 ρ = −0.011(순서)/−0.008(걸림)로 **처음부터 0** 이다(구슬은 한 통 출발로, 사다리는 항목 섞기로 지워야 했다 — 같은 하한선을 서로 다른 이유로 통과한다). **끝나면 안 뒤집은 카드까지 전부 깐다** — 걸림이 나오면 뒤 사람들은 안 뽑으므로, 덮어 둔 채 끝내면 "사실 전부 걸림 아니었냐" 를 반박할 수 없다. 안 뽑힌 카드는 흐리게 그려 결과에 관여하지 않았음을 구분한다. **재현은 배치를 정해 두는 것이지 결과를 정해 두는 게 아니다** — 뒤집는 순간에 결과를 고르는 코드가 없고, 어느 카드를 뽑느냐가 결과를 바꾼다. 모드 3종(한 명이 걸린다·순서 정하기·여러 명 뽑기), 2~12명, 색·글자·도형 3중 구분. **죽은 입력 감사 57칸(3씬×19키) 전수 통과** — 감사가 준비 화면 '뒤로' 키 3종(P·C·L)이 같은 문구만 다시 띄워 반응 없는 것처럼 보이던 것을 잡았고, **감사 신호를 느슨하게 하는 대신 입력에 소리를 붙여** 고쳤다. 120fps, 카드 108.3×153.7 CSS px(414×896), 외부 에셋 0. `PlatformAdapter` 미부착·랭킹 없음(`sdk_integrated=0`). 설계: `docs/specs/2026-08-24-card-flip-design.md` |
| `bee-guard` | `portal-fe/public/games/bee-guard/` (**다중 파일**) | **클린룸 15호** (V54 시드). 장르 프리셋 **`draw-to-solve` 의 첫 산출물** — 그린 선이 그대로 물리 물체가 되는 퍼즐. 두 단계로 자른다(**그리기=시간 정지 / 실행=고정 1/240초**): 그리면서 동시에 피하게 하면 손이 하나뿐인 사람에게 불가능하고, 무엇보다 내 그림이 맞았는지 판단할 수 없다. **이 게임의 핵심 장치는 판별 검사다** — 판마다 모범 답안 획을 코드에 넣어 `dev.verify()` 가 ① 답안대로 그리면 성공 ② 빈 손이면 실패 를 전수 확인한다(10/10). 사람이 손으로 보면 열 판을 넘기는 순간 안 하게 되고 그때 안 풀리는 판이 섞인다 — **실제로 이 검사가 만들다 만 판 다섯 개를 잡았다**. 검사는 설계도 두 번 뒤집었다: **한 방향에서만 오면 퍼즐이 아니다**(아이 반지름 46이라 120px 선 하나면 끝이고, 길목 높은 곳 선반 하나면 더 싸다 — 한 획 해답이 어떤 판은 **3,722개**였다), 그리고 **아이를 걷게 하는 건 더 나쁜 해법**이었다(맞느냐가 그 순간 아이 위치로 갈려 **막아서 이긴 건지 운인지 구분되지 않는다**). 지금 규칙은 **여러 방향**이고, 예산은 검사기가 찾은 최단 해답보다 조금만 크게 잡는다. **성공 조건은 '제한 시간 버티기'** — "벌을 다 쫓아내면 성공" 으로 두면 두 벽 사이에 갇혀 영원히 튀는 벌 하나로 판이 안 끝난다(구슬 레이스 함정의 재발 방지). 잉크는 예산(150~1000px)이고 손 경로를 14px 로 재표본해 캡슐로 잇는다(원본 점을 쓰면 손 떨림 하나가 물체 수십 개), 26px 미만 획은 버린다(찍힌 점이 벽이 되면 "안 그렸는데 막혔다"), 지우개는 획 단위. **실패해도 그림은 남는다** — 처음부터 다시 그리게 하면 시행착오 비용이 커진다. 물리는 원-캡슐 하나뿐이고 **선 위에 정확히 겹치면 법선이 없어 NaN → 화면에선 "벌이 사라졌다"** 라 수직 방향으로 밀어낸다. 판 10종(위/옆/천장 틈/소나기/꿀 유인/네 방향/기둥/추적/중력/복합). 죽은 입력 감사 **105칸(5화면×21키) 전수 통과** — 첫 판에서 ← 가 조용히 무시되던 것을 잡았다. **터치 타깃은 캔버스 좌표가 아니라 CSS px 로 재야 한다** — 버튼 78px 이 휴대폰에서 29.9 CSS px 이었고 116px 로 올려 44.5 를 맞췄다. 120fps, 외부 에셋 0, `PlatformAdapter` 미부착·랭킹 없음(점수 축이 없고 억지로 만들면 잉크 아끼기 대회가 된다). 설계: `docs/specs/2026-08-24-bee-guard-design.md` |
| `random-tower-defense` | `portal-fe/public/games/random-tower-defense/` (**다중 파일**) | **클린룸 5호** (V55 시드). 한국 커스텀맵 상위권의 '랜덤/운빨 디펜스' 계열 웹 이식 — 장르 프리셋 `coop-usemap-defense` 첫 산출물. **최대 4슬롯 협동**이고 각 슬롯이 `human|ai` 런타임 전환이라 **자리를 비우면 AI 가 대신 뽑고 합친다**(이탈 내성이 설계 상수). 월드 **11,520²(288×288 타일)**, 한 화면이 보는 면적 3단 줌 전부 10% 이하, 미니맵 탭 점프·핀치 줌. 네 구역의 회로가 전부 **중앙 공유 방벽**으로 모인다. 지킴이 37종 6등급(일반~신화)·조합 트리 8종·우두머리 4기. 기본 20판 10.5~11.6분 / 확장 40판 44.3분. GPU 동시 531개체 120fps. **가상패드를 붙이지 않는다** — 탭 기반이라 조이스틱이 맵을 가린다(네이티브 포인터로 전 조작 실측). 통합은 `lib/platform.js`, 세이브 키 `random-tower-defense.save.v1`, 랭킹 스칼라는 도달 판수. 설계: `docs/specs/2026-08-24-random-tower-defense-design.md` |
| `drift-continent` | `portal-fe/public/games/drift-continent/` (**다중 파일**) | 플래그십 오픈월드 RPG P1 (V22 시드 · V23 에서 PUBLISHED 승격). 유일하게 단일 HTML 이 아니다 — `index.html` + `js/{content,world,battle,ui,core}.js` 를 일반 script 태그로 순차 로드(ES module 금지, iframe 동일 오리진 보장). 세이브는 **IndexedDB**(이어하기 코드는 64KB 상한이라 부적합, 스키마 `S.v` 로 마이그레이션). 지상은 **시드 기반 절차 대륙 32×32 청크**(1024×1024 타일) — 고정 격자가 아니라 `world.js` 의 `biomeAt(cx,cy)`(값 노이즈 고도·습도 2축 + 위도 기온)로 결정된다. 표착항(16,16)·등대 곶(19,16)은 고정 앵커이고 손제작 콘텐츠(마을 NPC·등대 f1~f3)는 그대로. 표착항 거리로 티어 1~5 를 매겨 적이 스케일하고, 청크 해시로 랜드마크 6종(미니 던전 포함)이 배치된다. **직업 3종**(기사/궁수/마법사 — 기본 공격 방식·전용 스킬 2종·직업별 9노드 기술나무가 각각 다르다)과 **전직 6종**(Lv15 + 4챕터 완료 시 직업당 2갈래, 1회 한정, 전용 R 스킬 해금)이 있고, **메인 스토리 8챕터**가 표착항→근교→등대 곶→원거리 티어→갱도→최외곽 순으로 목표 지역을 옮겨 대륙 전체를 쓰게 한다 (챕터 정의 `DC.MAIN` 이 단일 원본 — NPC 제안/대기/보고 대화 노드를 여기서 자동 생성해 `DC.NPCS` 에 심는다). 새 게임은 장로가 플레이어에게 **걸어와** 대화를 열고 8단계 행동형 튜토리얼(모달 아님, 건너뛰기 가능)로 1챕터를 연다. 표착항은 울타리+십자 도로+중앙 광장(화톳불 회복 안전지대) 구조로 재설계돼 NPC 9명이 각자 자리를 갖는다 — 치유사(즉시 전회복+상태이상 해제)·게시판지기(의뢰 게시판 + 무한 반복 상시 의뢰 3종)·용병 대기소장(동료 3종 고용/강화/소생)·갈림길 무녀(전직). **동료**는 최대 1기(+마법사 소환 그림자) 고정 슬롯이고 쓰러져도 영구 손실 없이 40초 뒤 자동 소생한다. `M` 키(모바일은 미니맵 탭)로 확대 지도 오버레이 — 15/29/41 청크 3단계, 방문 fog·랜드마크·갱도 입구·챕터 목표 표시. **웨이포인트**(비석)로 이미 답사한 구간만 건너뛴다 — 표착항은 시작부터, 등대 곶은 3장(등대 진입)으로, 나머지 ~35곳은 랜드마크와 같은 좌표 해시(청크당 4%, 평균 최근접 2.6청크)로 흩어져 있어 직접 찾아가 F 로 새겨야 열린다. 출발은 비석 앞에서만 + 적 200px 안이면 불가 + 뱃삯 `6+2×청크거리`, 어디서든 표착항으로 돌아가는 `home_charm`(귀환 부적)은 같은 전투 제약을 탄다. 세이브 `S.v=4`: 직업 없는 v2 세이브는 **기사로 폴백**하고 옛 `main_light`/`main_keeper` 를 3·4챕터로 이관하며 오프닝은 완료 처리한다. v3 이하는 `S.wp` 가 없으므로 표착항만 활성인 상태로 시작한다(등대 진입 이력이 있으면 곶도 개방). 장기 트랙이므로 P2~P4 는 `docs/product/2026-08-06-game-expansion-research.md` 3장 참조 |

캔버스 게임 공용 정적 자산 (`portal-fe/public/games/lib/`):
- `touch.js` — 모바일 조작·레이아웃 엔진. **원형 아날로그 조이스틱**(한 손가락 360°, 8방향 KeyboardEvent 합성이라 게임별 입력 코드 무변경 — 대각선은 인접 두 키 동시) + 액션 버튼 + **레이아웃 fit**(게임 화면 상단 정렬, 하단 조작 영역 `--vt-pad-h` 확보, 가로/세로 비율 유지 contain). `canvas.width/height` **속성은 절대 건드리지 않는다**(인라인 style 만) — 게임 좌표계 보존이 12종 공용의 불변식. 옵션 `data-actions`(기존) `data-nodpad`(기존) `data-dirkeys="wasd"` `data-stick="fixed|floating|off"` `data-fit="0"`. API `GameTouch.axis()/pressed()/setVisible()/refit()/on()` — 비터치에서도 no-op 스텁이 있어 게임 쪽 가드 불필요
- `keys.js` — **플랫폼 입력 표준** (2026-08-15). 좌/우 손잡이 2레이아웃(방향키+ZXC(AS) / WASD+JKL(UI)) + 공통 Enter=일시정지·Esc=뒤로. localStorage 전 게임 공유 + 좌하단 전환 배지. 신규 게임은 `GameKeys.keys()` 네이티브 매핑, 레거시는 `GameKeys.remap(프로필)` 무수정 적용. 표준 문서: `docs/conventions/game-input-standard.md`. 레퍼런스: nova-strike
- `rank.js` — 랭킹 위젯. `GameRank.autoPanel(slug)`(#menu 하단 TOP10), `submit(slug, score, detail)`, `copyButton(getCode)`(이어하기 코드 📋 복사)
- `i18n.js` — 글로벌 한/영. localStorage('game_lang') → navigator.language 자동, 우상단 토글 자동 부착. 게임은 `GameI18n.init({ko,en})` + `TR()` + `data-i18n`. 카탈로그(제목/설명)는 `title_en`/`description_en` 컬럼(V17)
- `party.js` — **순서 정하기(DECIDER) 장르 인계 규약.** 허브의 「랜덤으로 돌리기」가 정한 참가자·방식을 `localStorage['kgd.party.v1']` 로 넘기고, 게임은 부팅 때 `GameParty.take('<슬러그>')` 한 줄로 받아 준비 화면을 건너뛴다. **주소가 아니라 저장소로 넘기는 이유는 이름이 접근 로그에 남지 않게 하기 위해서**다(정적 파일이라 쿼리스트링이 그대로 기록된다). 읽으면 지운다 — 남기면 새로고침마다 같은 판이 다시 시작돼 준비 화면에 못 들어간다
- `daily.js` — 데일리 퍼즐 공용. KST 자정 롤오버 날짜 시드(`seed`/`rng`/`shuffle`), 연속 출석 스트릭, 오늘 결과 저장(재제출 방지), 다음 퍼즐 카운트다운, 이모지 결과 공유
- `thumbs/shots/` — 실플레이 캡처 썸네일 (320×180)

Snake 클라이언트를 고친 뒤에는 `jsBrowserDistribution` 을 다시 돌려 산출물을 복사해야 반영된다.
