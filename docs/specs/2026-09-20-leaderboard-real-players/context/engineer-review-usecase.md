# Usecase Review — 게임 랭킹에 실제 플레이어 기록만 남긴다

**Verdict: REVISE** (1회차, 이슈 5 + 참고 4)

스펙 그대로 구현해도 R1(자동화)·R3·R5·R6·R7 은 성립한다. 되돌려 보내는 이유는 **사용자가 직접
겪을 여정(운영자 로그인 플레이)에 구멍 둘과 검증 공백 하나**가 있어서다 — 게임 22종에서는
로그인해도 기록되고, 로그인 1시간 뒤부터는 어느 게임에서든 기록되며, 그 경로를 운영에서
확인하는 행이 검증표에 없다. 셋 다 스펙 문장과 한 줄짜리 코드 변경으로 닫힌다.

지식베이스: `HNS_KB_PATH`(1989v 볼트) 조회 — [[amp-arena]] (1989v, updated 2026-09-11) §플랫폼
순위표가 아레나 제출 경로·CDP Fetch 가로채기 실측을 기록. 레포 문서와 충돌 없음.

## 여정별 판정

| # | 여정 | 스펙대로 구현했을 때 실제 결과 | 판정 |
|---|---|---|---|
| a | 운영자 **로그인** 상태로 캔버스 게임 플레이 | `auth.js` 를 싣는 52종: Bearer → `X-User-Roles` → `excluded=true`, 기록 없음. `autoPanel` 을 쓰는 46종은 「운영·자동화 기록 — 랭킹에 오르지 않음」 표시, `platform.js` 28종은 표시 없음(지금 `submitted` 도 안 뜬다). **`auth.js` 를 안 싣는 22종은 게스트로 기록된다** | REVISE-1 · REVISE-5 |
| b | 운영자 **비로그인** | 게스트로 기록. 스펙 R2·key-decisions·`game/CLAUDE.md` 규칙에 명시됨 | OK |
| b′ | 운영자 로그인 **1시간 경과** 후 제출 | 액세스 토큰 만료 → 게이트웨이 optional 필터가 익명 처리 → **게스트로 기록**, 위젯은 「✅ 랭킹 등록 — N위」. 스펙 어디에도 없다 | REVISE-2 |
| c | 헤드리스 e2e 운영 실행 | `HeadlessChrome` UA → `excluded=true`, 행 없음. 단 배포된 아레나 번들은 「연습 순위표 0위 · N점 (최고 기록 유지)」를 띄우고 `noteRank` 정규식은 그걸 통과시킨다 | REVISE-4 |
| d | 실제 게스트 | 변화 없음 (`Authorization` 없음 → 지금과 같은 경로) | OK |
| e | 실제 로그인 회원(비운영자) | `member_id` 가 처음으로 연결된다 — V64 주석·게이트웨이 라우트 주석이 원래 의도한 것. `/me` 패널의 최고 기록이 캔버스 게임에서도 채워지기 시작한다 | OK, 부수 효과 명시 권고(참고 1) |
| f | 정리 뒤 허브 레일 | 행이 0이 된 보드는 레일에서 빠지고, 0개면 레일 자체가 숨는다 — 기존 설계 그대로 | OK, 예상치 선기록 권고(참고 2) |

## 이슈

### REVISE-1 — 게임 22종은 로그인해도 운영자 판별이 안 된다 (여정 a)

- 스펙 근거: `spec.md` §portal-fe — "`auth.js` 를 안 싣는 게임에서는 `GameAuth` 가 없으므로 지금처럼 게스트 제출이다" — 수와 결정이 없다.
- 코드 근거: `portal-fe/public/games/lib/rank.js:102-117` 의 `postScore` 가 `window.GameAuth` 를 읽고, 그 객체는 `portal-fe/public/games/lib/auth.js:37` 만 만든다. `lib/rank.js` 를 싣는 index.html 74개 중 **22개가 `lib/auth.js` 를 싣지 않고 전부 `GameRank.submit` 을 호출한다**:
  `acid-rain` `alley-pool` `beat-dojo` `block-burst` `breeze-links` `cog-foundry` `crate-shift` `crimson-ravine` `drift-continent` `element-pilgrim` `hand-alchemy` `mine-pioneer` `number-garden` `pixel-mine` `quad-weave` `rift-front` `rope-works` `royal-grid` `sketch-sleuth` `spud-arena` `stone-sage` `word-warden`
- 사용자 목표("내가 플레이한 기록이 안 쌓이게")와 R4 의 자기 근거("R2 가 캔버스 게임에서 실제로 동작하기 위한 전제")에 정면으로 어긋난다. 2026-08-28 사고(`auth.js:4-8` 주석 — 21곳 복사본이 뒤처져 로그인 사용자가 전 게임에서 게스트 취급)와 같은 모양의 구멍이 22곳 남는다.
- 권고: 22개 `index.html` 에 `<script src="../lib/auth.js"></script>` 를 `rank.js` 앞에 한 줄씩 넣는 것을 R4 에 포함한다(파일당 1줄, 로직 변경 없음). 넣지 않기로 하면 `game/CLAUDE.md` Key Rules 에 그 22종은 운영자를 못 가린다고 목록으로 적는다 — 어느 쪽이든 스펙이 정해야 한다.

### REVISE-2 — 로그인 1시간 뒤의 운영자 제출은 게스트로 기록된다 (여정 b′)

- 스펙 근거: R2 는 "게스트 상태의 운영자는 판별하지 않는다"까지만 말한다.
- 코드 근거: 액세스 토큰 1시간 `auth/app/src/main/resources/application.yml:52`, 쿠키 30일 `portal-fe/src/auth/auth.ts:28`, 게임 안 `lib/auth.js` 에는 재발급이 없다. 게이트웨이 optional 필터는 만료 토큰을 `reject` → `required=false` → 익명으로 통과시킨다(`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt:39-40,46`). SPA 쪽은 이미 같은 함정을 적어 뒀다 — `portal-fe/src/api/gameApi.ts:22` "액세스 토큰이 만료되면 평점·세션·점수 제출이 조용히 게스트 취급된다", `portal-fe/src/auth/refresh.ts:4-6`. SPA 재발급은 401 에서만 도는데 `/scores` 는 optional 이라 401 을 내지 않는다.
- 결과: 운영자가 상세 페이지를 연 지 1시간이 넘은 판(장시간 게임: deadline·nether-return·아레나 연전)의 기록은 `X-User-Roles` 없이 도착해 **기록되고**, 위젯은 「✅ 랭킹 등록 — N위」를 띄운다. 사용자는 "로그인했는데 왜 남았지"가 된다.
- 권고: 스펙 §규칙과 `game/CLAUDE.md` Key Rules 문장을 「테스트는 로그인 상태로, **상세 페이지를 연 지 1시간 안에**(액세스 토큰 만료 뒤 제출은 게스트다)」로 고친다. 코드로 막으려면 범위가 커지므로(게임 안 재발급) 문장으로 둔다.

### REVISE-3 — 운영자 경로의 끝-끝 검증이 없다 (AC 추적성)

- 스펙 근거: 검증표 V1~V6 중 운영자(R2)·Bearer(R4)를 보는 것은 V1 단위 테스트(`operator=true` 를 **서비스에 직접 넣는다**)뿐이다. 쿠키 → `GameAuth.token()` → `Authorization` → 게이트웨이 `X-User-Roles` → 컨트롤러 파싱 → `excluded` 의 사슬은 어디서도 재지 않는다. V4·V5 는 헤드리스 UA 경로(R1)만 본다.
- 코드 근거: 사슬의 각 마디는 존재한다 — `AuthenticationGatewayFilter.kt:77-78` 이 `X-User-Roles` 를 `,` 로 잇고, 같은 파싱 선례가 `game/feature/src/main/kotlin/com/kgd/game/presentation/suggestion/controller/GameSuggestionController.kt:149-151` 에 있다. 하지만 "마디가 있다"와 "끝까지 흐른다"는 다른 사실이고, 이 기능의 존재 이유가 바로 그 사슬이다.
- 전제조건도 적혀 있지 않다: 운영자 계정의 JWT `roles` 에 `ROLE_ADMIN` 이 실제로 들어 있는가 — 어드민 부트스트랩은 제거됐고 역할은 `member_roles` 행뿐이다(루트 `CLAUDE.md` §회원 식별 최소화).
- 권고: V7 추가 — 운영자가 `game.1989v.com` 에 로그인한 뒤 `autoPanel` 게임 하나와 아레나 연습 한 판. 기대: 위젯 문구 「운영·자동화 기록 — 랭킹에 오르지 않음」, 파드 로그 `score excluded … operator=true`, 그 닉으로 `SELECT COUNT(*)` 변화 없음. 전제로 `member_roles` 에 `ROLE_ADMIN` 행 확인을 한 줄 넣는다. 제외 로그 한 줄에는 `operator`/`automation` 을 **따로** 찍어 V5 가 둘을 구분하게 한다.

### REVISE-4 — 배포된 아레나가 띄울 문구와 e2e `noteRank` 처리가 정해져 있지 않다 (여정 c)

- 스펙 근거: §amp-arena "재게시는 하지 않는다", R6 "응답 `excluded === true` 인지 … 닉네임이 없는지".
- 코드 근거: 배포된 번들의 `amp-arena/client/src/platform/score.ts:60-61` 은 `{applied:false, rank:0}` 을 받으면 **「연습 순위표 0위 · N점 (최고 기록 유지)」** 를 그린다. `amp-arena/tools/e2e-prod-score.mjs:27` 의 `noteRank = /^연습 순위표 \d+위 · \d+점/` 은 `0위` 를 통과시키고, 아레나를 재게시하는 순간 새 문구(「… 운영·자동화 기록은 순위표에 오르지 않습니다」)에서 빨간불이 된다.
- 결과: 운영자(아레나를 가장 많이 플레이한 사람)는 다음 게시까지 매 판 「0위」를 본다 — 버그로 오독하기 쉽다. 스크립트는 지금 번들에 묶여 있어 다음 게시가 조용히 깨뜨린다.
- 권고: ① key-decisions 에 「다음 게시까지 아레나는 `순위표 0위 · (최고 기록 유지)` 로 보인다」 한 줄. ② R6 에 `noteRank` 처분을 적는다 — 제거하거나 두 문구를 모두 받는 정규식으로, 그리고 스크립트가 찍는 번들 해시(`:14`)를 결과에 남긴다. ③ 응답 가로채기는 `cdp-page.mjs` 에 Network 도메인이 없으므로 `.practice` 클릭 전 `window.fetch` 를 감싸는 방식이 현실적이다 — [[amp-arena]] (1989v, 2026-09-11) 가 프리뷰에서 CDP Fetch 로 같은 요청을 가로챈 선례를 적어 뒀다.

### REVISE-5 — 「띄운다」는 46종에서만 참이다 (여정 a, 문구)

- 스펙 근거: R4 "`excluded` 응답이면 … 띄운다(ko/en)".
- 코드 근거: `note()` 는 `noteEl` 이 있을 때만 쓰고(`rank.js:134`), `noteEl` 은 `autoPanel` 이 만든다(`rank.js:257`). `GameRank.submit` 호출처 49개 중 `autoPanel` 을 부르는 게임은 46개. `lib/platform.js` 28종은 `GameRank.panel` 만 부르고(`platform.js:111`) 노트 표면이 없어 **아무것도 안 뜬다** — 지금 `submitted` 도 안 뜨므로 회귀는 아니다.
- 권고: 스펙 문장을 「`autoPanel` 을 쓰는 게임(46종)에서 띄운다. `platform.js` 게임은 지금도 제출 결과를 표시하지 않는다」로 고친다. 코드 변경은 권하지 않는다(YAGNI).

## 참고 (판정에 영향 없음, 스펙에 한 줄씩)

1. **여정 e 부수 효과**: `rank.js` 가 Bearer 를 싣는 순간 캔버스 게임 57종의 로그인 제출이 처음으로 `member_id` 를 갖는다. 이건 요청 밖 변경이지만 원래 설계다 — `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:293-294` "로그인 사용자만 X-User-Id 로 식별해 기록을 잇는다", `game/feature/src/main/resources/gamedb/migration/V64__game_score_member.sql:7` "이후 제출부터 연결한다". 눈에 보이는 변화는 `/me` 패널(`portal-fe/src/pages/games/GameDetailPanels.tsx:122-129`)의 최고 기록이 아레나 밖에서도 채워지는 것. 반대로 **운영자 자신의 `/me` 패널은 플레이 횟수는 늘고 최고 기록은 영영 비어 있다** — 세션은 기록되고 점수만 안 남으므로. 둘 다 스펙 R4 에 한 문장.
2. **여정 f 예상치**: `GameScoreService.kt:133` 이 빈 보드를 거르고 `portal-fe/src/pages/games/LeaderboardRail.tsx:84` 가 0개면 레일을 숨긴다 — "정직한 화면"(`GameScoreService.kt:92-96`) 그대로라 받아들일 만하다. 다만 V6 이 행 수만 본다. 정리 **전** 미리보기에서 대상 17행을 (game, track, board) 로 묶어 「남는 행 0 인 보드」를 적고, 정리 뒤 `GET /api/v1/games/leaderboards` 와 아레나 상세 상단이 그 예상대로인지 대조한다. 미리보기 SELECT 에 `nickname, member_id, created_at` 을 포함해 `LIKE '실측%'` 에 실제 플레이어가 섞이지 않았음을 눈으로 확인한다.
3. **양성 경로 검증의 소실**: R1 이후 "실제로 올라간다(`applied=true`, 보드에 뜬다)"는 헤드리스로 더는 못 잰다 — 사람 UA 를 씌우면 행이 남는다. `game/CLAUDE.md` 의 새 규칙("e2e 는 UA 를 씌우지 않는다") 옆에 「양성 경로가 필요하면 사람 UA + 사후 삭제, 또는 로컬 k3d」를 한 줄 붙인다. 원장 계측에서 같은 일을 이미 겪었다(memory `measurement-needs-human-ua`).
4. **롤링 배포 창**: `rank.js`(portal-fe 이미지)와 백엔드(code-dictionary 이미지)는 따로 배포된다. 백엔드가 먼저면 옛 `rank.js` 가 `excluded` 응답에 「✅ 랭킹 등록 — 0위」를 띄운다(`rank.js:113` 은 `d` 만 본다). 운영자·자동화만 보는 순간이라 조치는 불필요하나, 배포 직후 테스트에서 「0위」를 보면 이것이다 — V4 실행 순서(둘 다 Synced 뒤)에 한 줄.

## AC ↔ 시나리오 추적표

| 요구 | 시나리오 | 검증 | 공백 |
|---|---|---|---|
| R1 자동화 제외 | c | V1(automation) · V2 · V4 · V5 | — |
| R2 운영자 제외 | a · b · b′ | V1(operator) | **끝-끝 검증 없음**(REVISE-3), 22종 미적용(REVISE-1), 1시간 창(REVISE-2) |
| R3 200 + `excluded` | a · c | V1 반환값 · V4 응답 | — |
| R4 Bearer + 문구 | a · e | 없음 | **검증 없음** — V7 이 겸한다(REVISE-3); 문구 범위(REVISE-5) |
| R5 판별기 이동 | — | V2 · V3 | — |
| R6 e2e 판정 반전 | c | V4 | `noteRank` 미정(REVISE-4) |
| R7 데이터 정리 | f | V6 | 예상 화면 미기록(참고 2) |
| R8 문서 | — | — | 문서 전용, 검증 불요 |

## 전제조건 / 사후조건 (스펙에 없어서 적는다)

- 전제: 운영자 계정에 `ROLE_ADMIN` 역할 행이 있다 · 플레이하는 게임이 `lib/auth.js` 를 싣는다 · 상세 페이지를 연 지 1시간 안이다 · e2e 는 UA 를 덮어쓰지 않는다.
- 사후: 제외 제출은 `game_score`·`game_score_daily` 어느 쪽에도 행이 없다(`GameScoreRepositoryPort.submit` 한 호출이 두 보드를 쓰므로 호출을 건너뛰면 둘 다 건너뛴다 — `game/feature/src/main/kotlin/com/kgd/game/application/play/port/SavePorts.kt:45-47`) · 플레이 세션·`game_stats` 는 그대로 쌓인다(범위 밖, 요구사항 §범위 밖).

## 예외·에지 (스펙이 다루는 것 / 빠진 것)

- 다룸: 규격 밖 입력은 제외 판정 **전**에 400(스펙 §game). 네트워크 실패는 기존 `submitFail`(`rank.js:116`). 옛 서버가 `excluded` 필드를 안 주면 `d.excluded` 가 undefined 라 기존 문구로 떨어진다 — 하위 호환.
- 빠짐: 위 REVISE-2(토큰 만료), 참고 4(배포 순서). UA 가 비는 실제 사람은 Reactor Netty 마커로 제외되지만(`CrawlerUserAgents.kt:27-31`) 브라우저는 항상 UA 를 보내므로 현실적으로 없다 — 적지 않아도 된다.
- 롤백: 서비스는 조건 한 줄이라 이미지 되돌리기로 끝난다. 데이터 정리는 되돌릴 수 없으므로 미리보기 → 실행 순서(test-quality.md)가 유일한 안전장치 — 참고 2 의 미리보기 열 추가가 그 안전장치를 실질화한다.

## Round 2 — **SHIP**

1회차 이슈 5건·참고 4건이 전부 스펙에 반영됐다. 재검토 범위는 `spec.md`·`planning/requirements.md`·
`context/key-decisions.md`·`planning/test-quality.md` 넷.

| 1회차 | 반영 위치 | 확인 |
|---|---|---|
| REVISE-1 22종 `auth.js` | `spec.md:108-114`, `requirements.md:30-31`, `key-decisions.md:13` | 22종 목록 일치. 부작용 주장(「22종 전부 code UI 없음」)을 grep 으로 대조 — `#codeInput`/`#codeShow` 0건, `.game-signed-in` 소비자는 `lib/menu.css:154-156` 뿐 |
| REVISE-2 1시간 창 | `spec.md:36-39`(규칙), `:158-160`(CLAUDE.md 문구), `requirements.md:44`(범위 밖) | 문장으로 두는 결정 포함 |
| REVISE-3 운영자 끝-끝 | `spec.md:179` V7(전제 `member_roles` · 일반 브라우저 · 로그 `operator=true` · COUNT 무변화), `:175` V3 조립 테스트, `:82` 로그 리터럴에 `operator`/`automation` 분리 | 사슬 전 마디가 검증표에 잡힌다 |
| REVISE-4 아레나 0위 · `noteRank` | `spec.md:123-125`, `key-decisions.md:10`, `:127-133`(fetch 감싸기 · `${expectScore}점` 포함 판정 · 번들 해시) | 새 문구·옛 문구 둘 다 `N점` 을 포함하므로 판정이 게시 전후를 가리지 않는다 |
| REVISE-5 46종 문구 범위 | `spec.md:105-106`, `requirements.md:32` | — |
| 참고 1 `member_id` 부수 효과 · 운영자 `/me` | `spec.md:116-118` | — |
| 참고 2 정리 미리보기 | `spec.md:137-152` — 패턴으로 읽고 **id 로 지운다**, 열에 `member_id`·`created_at` 포함, `verifications/purge.md` 에 보존, 순서는 정리 마지막 | 레일에서 사라질 보드는 미리보기의 `game_id/track/board` 열로 도출된다 |
| 참고 3 양성 경로 | `spec.md:159-160` | — |
| 참고 4 배포 순서 | `spec.md:164-165`, V5 「둘 다 Synced 뒤」 | — |

남은 것 (SHIP 을 막지 않는다, 구현·검증 때 한 줄씩):

- `spec.md:179` V7 의 예시 게임 `archer-outbreak` 은 유니티 + `platform.js` 라 `autoPanel` 이 없다
  (`portal-fe/public/games/archer-outbreak/index.html:144-148`) — ③ 위젯 문구는 거기서 안 뜬다. ①②가 근거이므로
  판정엔 영향 없지만, ③까지 보려면 `auth.js`+`autoPanel` 게임(`cliff-climber`·`abyss-drill`·`cave-glide` 등)으로
  예시를 바꾼다.
- `spec.md:179` V7 대조("`ROLE_USER` 토큰의 curl 제출")는 **비운영자 계정의 토큰**이 있어야 한다 — 운영자 계정 하나뿐이면
  만들 수 없다. 없으면 V3-③(조립 `ROLE_USER` → `submit` 1회)으로 갈음하고, 운영 curl 은 토큰 없는 사람 UA 게스트
  제출(`applied=true`)로 낮춘다. 어느 쪽이든 그 대조 행의 닉은 `실측` 접두로 두어야 `spec.md:143-144` 의 읽기
  질의에 잡혀 정리 대상에 든다(`:179` 「정리 대상에 넣는다」가 그것을 전제한다).
