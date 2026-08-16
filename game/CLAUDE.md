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
| `drift-continent` | `portal-fe/public/games/drift-continent/` (**다중 파일**) | 플래그십 오픈월드 RPG P1 (V22 시드 · V23 에서 PUBLISHED 승격). 유일하게 단일 HTML 이 아니다 — `index.html` + `js/{content,world,battle,ui,core}.js` 를 일반 script 태그로 순차 로드(ES module 금지, iframe 동일 오리진 보장). 세이브는 **IndexedDB**(이어하기 코드는 64KB 상한이라 부적합, 스키마 `S.v` 로 마이그레이션). 지상은 **시드 기반 절차 대륙 32×32 청크**(1024×1024 타일) — 고정 격자가 아니라 `world.js` 의 `biomeAt(cx,cy)`(값 노이즈 고도·습도 2축 + 위도 기온)로 결정된다. 표착항(16,16)·등대 곶(19,16)은 고정 앵커이고 손제작 콘텐츠(마을 NPC·등대 f1~f3)는 그대로. 표착항 거리로 티어 1~5 를 매겨 적이 스케일하고, 청크 해시로 랜드마크 6종(미니 던전 포함)이 배치된다. **직업 3종**(기사/궁수/마법사 — 기본 공격 방식·전용 스킬 2종·직업별 9노드 기술나무가 각각 다르다)과 **전직 6종**(Lv15 + 4챕터 완료 시 직업당 2갈래, 1회 한정, 전용 R 스킬 해금)이 있고, **메인 스토리 8챕터**가 표착항→근교→등대 곶→원거리 티어→갱도→최외곽 순으로 목표 지역을 옮겨 대륙 전체를 쓰게 한다 (챕터 정의 `DC.MAIN` 이 단일 원본 — NPC 제안/대기/보고 대화 노드를 여기서 자동 생성해 `DC.NPCS` 에 심는다). 새 게임은 장로가 플레이어에게 **걸어와** 대화를 열고 8단계 행동형 튜토리얼(모달 아님, 건너뛰기 가능)로 1챕터를 연다. 표착항은 울타리+십자 도로+중앙 광장(화톳불 회복 안전지대) 구조로 재설계돼 NPC 9명이 각자 자리를 갖는다 — 치유사(즉시 전회복+상태이상 해제)·게시판지기(의뢰 게시판 + 무한 반복 상시 의뢰 3종)·용병 대기소장(동료 3종 고용/강화/소생)·갈림길 무녀(전직). **동료**는 최대 1기(+마법사 소환 그림자) 고정 슬롯이고 쓰러져도 영구 손실 없이 40초 뒤 자동 소생한다. `M` 키(모바일은 미니맵 탭)로 확대 지도 오버레이 — 15/29/41 청크 3단계, 방문 fog·랜드마크·갱도 입구·챕터 목표 표시. **웨이포인트**(비석)로 이미 답사한 구간만 건너뛴다 — 표착항은 시작부터, 등대 곶은 3장(등대 진입)으로, 나머지 ~35곳은 랜드마크와 같은 좌표 해시(청크당 4%, 평균 최근접 2.6청크)로 흩어져 있어 직접 찾아가 F 로 새겨야 열린다. 출발은 비석 앞에서만 + 적 200px 안이면 불가 + 뱃삯 `6+2×청크거리`, 어디서든 표착항으로 돌아가는 `home_charm`(귀환 부적)은 같은 전투 제약을 탄다. 세이브 `S.v=4`: 직업 없는 v2 세이브는 **기사로 폴백**하고 옛 `main_light`/`main_keeper` 를 3·4챕터로 이관하며 오프닝은 완료 처리한다. v3 이하는 `S.wp` 가 없으므로 표착항만 활성인 상태로 시작한다(등대 진입 이력이 있으면 곶도 개방). 장기 트랙이므로 P2~P4 는 `docs/product/2026-08-06-game-expansion-research.md` 3장 참조 |

캔버스 게임 공용 정적 자산 (`portal-fe/public/games/lib/`):
- `touch.js` — 모바일 조작·레이아웃 엔진. **원형 아날로그 조이스틱**(한 손가락 360°, 8방향 KeyboardEvent 합성이라 게임별 입력 코드 무변경 — 대각선은 인접 두 키 동시) + 액션 버튼 + **레이아웃 fit**(게임 화면 상단 정렬, 하단 조작 영역 `--vt-pad-h` 확보, 가로/세로 비율 유지 contain). `canvas.width/height` **속성은 절대 건드리지 않는다**(인라인 style 만) — 게임 좌표계 보존이 12종 공용의 불변식. 옵션 `data-actions`(기존) `data-nodpad`(기존) `data-dirkeys="wasd"` `data-stick="fixed|floating|off"` `data-fit="0"`. API `GameTouch.axis()/pressed()/setVisible()/refit()/on()` — 비터치에서도 no-op 스텁이 있어 게임 쪽 가드 불필요
- `keys.js` — **플랫폼 입력 표준** (2026-08-15). 좌/우 손잡이 2레이아웃(방향키+ZXC(AS) / WASD+JKL(UI)) + 공통 Enter=일시정지·Esc=뒤로. localStorage 전 게임 공유 + 좌하단 전환 배지. 신규 게임은 `GameKeys.keys()` 네이티브 매핑, 레거시는 `GameKeys.remap(프로필)` 무수정 적용. 표준 문서: `docs/conventions/game-input-standard.md`. 레퍼런스: nova-strike
- `rank.js` — 랭킹 위젯. `GameRank.autoPanel(slug)`(#menu 하단 TOP10), `submit(slug, score, detail)`, `copyButton(getCode)`(이어하기 코드 📋 복사)
- `i18n.js` — 글로벌 한/영. localStorage('game_lang') → navigator.language 자동, 우상단 토글 자동 부착. 게임은 `GameI18n.init({ko,en})` + `TR()` + `data-i18n`. 카탈로그(제목/설명)는 `title_en`/`description_en` 컬럼(V17)
- `daily.js` — 데일리 퍼즐 공용. KST 자정 롤오버 날짜 시드(`seed`/`rng`/`shuffle`), 연속 출석 스트릭, 오늘 결과 저장(재제출 방지), 다음 퍼즐 카운트다운, 이모지 결과 공유
- `thumbs/shots/` — 실플레이 캡처 썸네일 (320×180)

Snake 클라이언트를 고친 뒤에는 `jsBrowserDistribution` 을 다시 돌려 산출물을 복사해야 반영된다.
