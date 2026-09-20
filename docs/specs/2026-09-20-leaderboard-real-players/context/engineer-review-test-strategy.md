# Test Strategy Review — 게임 랭킹에 실제 플레이어 기록만 남긴다

**Verdict: REVISE** (round 1)

한 줄: V1·V2·V4·V5·V6 은 전부 **대상의 산출물**(저장소 포트 호출·서버 응답·보드 GET·파드 로그·DB 행 수)로
판정하고, V4 는 「빨간불 먼저」 요구까지 갖춰 진짜 회귀 검사다. 다만 그 회귀 검사는 **R1(자동화)만** 증명한다 —
헤드리스 실행은 UA 에서 먼저 걸리므로 운영자 판별(R2)·위젯 Bearer(R4)·컨트롤러 배선이 통째로 죽어 있어도
V1~V6 이 전부 초록불이다. 이번 요구의 절반(운영자 본인 플레이 2+13행)이 검증 없이 나간다.

## Seed discovery (근거)

- 스펙: `spec.md:103-112` 검증표 V1~V6, `planning/test-quality.md:3-9`, `planning/requirements.md:22-38` R1~R8
- 표준: `docs/standards/test-rules.md:6-7`(Kotest BehaviorSpec + MockK), `:11-12`(Application 은 Outbound Port 만 mock), `:17`(구현체명 + `Test`)
- 코드:
  - `game/feature/src/main/kotlin/com/kgd/game/application/play/service/GameScoreService.kt:59-74` — `execute` 는 `resolveGameId`(62) → 검증(65-66) → `scoreRepository.submit`(69). 반환은 `Pair<Boolean, Int>`
  - `game/feature/src/main/kotlin/com/kgd/game/presentation/play/controller/GameScoreController.kt:47-66` — `X-User-Id` 만 받고 `val (applied, rank)` 위치 분해(53)
  - `analytics/app/src/main/kotlin/com/kgd/analytics/presentation/event/CrawlerUserAgents.kt:25` `headlesschrome` 마커, `:31` `reactornetty`, `:41-45` `isCrawler`
  - `analytics/app/src/test/kotlin/com/kgd/analytics/presentation/event/CrawlerUserAgentsTest.kt:14` HeadlessChrome 케이스(손으로 적은 `120.0`)
  - `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:294-301` `game-score-submit` + `optionalUserConfig()`; `gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt:77-78`(서버가 `X-User-Roles` 를 `,` 로 조인), `:86-89`(익명 통과 시 두 헤더 제거)
  - `amp-arena/tools/e2e-prod-score.mjs:27-38`, `amp-arena/tools/cdp-page.mjs:20,25-26`(`Page`·`Runtime` 만 enable, `events` 는 메서드당 핸들러 하나)
  - `amp-arena/client/src/platform/score.ts:58-62` — `applied=false` 면 `「연습 순위표 {rank}위 · N점 (최고 기록 유지)」`
  - `portal-fe/public/games/lib/rank.js:102-117` — 오늘 `Authorization` 을 싣지 않음(grep 0건), `:113` 은 `d.rank` 만 봄; `lib/auth.js:21,37` `GameAuth.token()`
  - 게임 HTML 80개가 `lib/rank.js` 를 싣고 그중 58개가 `lib/auth.js` 도 싣는다(`portal-fe/public/games/*/index.html` grep, 2026-09-20)
  - 컨트롤러 테스트 선례: `game/feature/src/test/kotlin/com/kgd/game/presentation/access/PrivateGameGateControllerTest.kt:17-26,37-44` — Spring 컨텍스트 없이 생성자로 조립, 실제 서비스 + 실제 어댑터 + mock 포트. 반면 `GameSuggestionController.kt:150-151` 의 `X-User-Roles → isOperator` 매핑은 어느 테스트도 안 본다(`game/feature/src/test` 에 `isOperator(` 0건)
  - 실측: `scripts/cdp-chrome.sh:83` 이 띄우는 `--headless=new` 크롬 153 의 `/json/version` User-Agent =
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`
    (2026-09-20 이 리뷰에서 start→읽기→stop 한 명령으로 측정) — V2 의 「`--headless=new` 도 걸린다」는 사실이다
  - 로그 레벨: `content/app/src/main/resources/application.yml`·`application-kubernetes.yml` 에 `logging:` 블록 없음, `k8s/base/content/deployment.yaml` 에 LOGGING env 없음 → Spring 기본 INFO, V5 의 `log.info` 는 보인다. 파드 이름은 `content`(`deployment.yaml:4`) — 스펙 헤더의 code-dictionary 가 아니다

`HNS_KB_PATH` 미설정 — kb 조회 없음.

## AC → 검증 매핑

| 요구 | 검증 | 판정 근거가 대상의 산출물인가 | 비고 |
|---|---|---|---|
| R1 자동화 제출 미기록 | V1(`automation=true`), V2, V4, V5 | 예 — `submit` 호출 0회 · 응답 · 보드 GET · 파드 로그 | 충분 |
| R2 운영자 제출 미기록 | V1(`operator=true`) 만 | V1 은 **손으로 세운 플래그**를 넣고 서비스만 본다 | **컨트롤러 배선 → 서비스까지 이어진 검증 없음.** V4 는 헤드리스라 UA 에서 먼저 걸려 R2 를 구별 못 한다 |
| R3 200 + `excluded=true` | V1(반환값), V4(응답) | 예 | 충분 |
| R4 rank.js Bearer + excluded 문구 | **없음** | — | V4 는 아레나(`score.ts`) 경로다. rank.js 를 지나는 검증이 없다 — R2 의 전제인데 무동작이어도 초록 |
| R5 판별기 common 이동 | V2, V3 | 예 | 충분 |
| R6 e2e 판정 뒤집기 | V4 | 예 + 빨간불 선행 | 아래 F3 참조 |
| R7 데이터 정리 | V6 | 예 — 행 수 | 아래 F4(순서) |
| R8 문서 | 없음 | — | 문서라 검증 대상 아님. 다만 `hns:validate` 의 docs→code 일치는 남는다 |

빈 행: R4. 반쪽 행: R2.

## Checklist

| # | 항목 | 결과 |
|---|---|---|
| 1 | AC 마다 테스트 1개 이상 | **미충족** — R4 없음, R2 는 플래그 단위만 |
| 2 | 레이어 배정 | 적절 — 판별기 순수 단위, 서비스는 포트 mock, 운영 회귀는 e2e. 컨트롤러 배선 층만 비어 있다(F2) |
| 3 | mock 경계 | 적절 — V1 은 Outbound Port(`GameScoreRepositoryPort`·`GameRepositoryPort`) 만 mock (`test-rules.md:12`) |
| 4 | 테스트 데이터 전략 | 적절 — 기존 `game()`·`entry()` 빌더(`GameScoreServiceTest.kt:33-60`) 재사용. UA 문자열은 실측값을 쓰라(F5) |
| 5 | 부정·경계 케이스 | **부족** — 「제외 대상이지만 규격 밖 입력 → 400」 이 없다(F1) |
| 6 | 명명 규칙 | 적절 — `GameScoreServiceTest`·`CrawlerUserAgentsTest` 는 구현체명 + `Test` |

## Findings

### F1 (REVISE) — V1 에 「검증이 제외보다 앞선다」 케이스가 없다

스펙 `spec.md:54-56` 은 제외 분기를 **검증 뒤, 저장소 앞**에 두고, 그 이유까지 적었다(「시험 스크립트가 규격 밖
입력을 400 으로 보게」). 그런데 V1(`spec.md:107`)은 `operator`/`automation`/둘 다 false 세 케이스뿐이다.
분기를 검증 위로 올려도 세 케이스 다 초록이다.

추가할 케이스: `automation=true` + 닉 1자(또는 `score=-1`) → `BusinessException(INVALID_INPUT)` 이고 `excluded`
반환이 아님. 근거는 던져진 예외 — 대상의 산출물이다.

### F2 (REVISE) — 운영자 경로(R2)는 컨트롤러 배선부터 위젯까지 어디서도 재지지 않는다

- V1 은 `Command(operator = true)` 를 **테스트가 만들어** 넣는다. `GameScoreController` 가 `X-User-Roles` 를
  `operator` 로 옮기는 줄(`spec.md:60-61`)은 어느 검증도 안 본다. 선례 `GameSuggestionController.kt:150-151` 도
  같은 매핑을 테스트 없이 두고 있다 — 관행이긴 하나 이번엔 그 줄이 곧 게이트다.
- V4 는 `--headless=new` 로 돌고 UA 가 `HeadlessChrome/153.0.0.0`(실측)이라 **UA 에서 먼저 걸린다.**
  `operator` 배선이 `false` 고정이어도 응답은 `excluded=true`, 보드에 닉 없음, 로그 한 줄 — 전부 통과.
  V4 는 R1 의 회귀 검사이지 R2 의 회귀 검사가 아니다.
- R4(`rank.js` Bearer, `spec.md:70-72`)는 R2 가 캔버스 게임 58종에서 성립하는 **전제**인데(`requirements.md:29-30`)
  검증표에 없다. `GameAuth.token()` 이 null 을 주거나 `headers` 조립이 빠져도 아무 검사도 빨개지지 않는다 —
  오늘 `go` 14행 중 13행이 `member_id NULL` 인 그 상태(`requirements.md:17-18`)가 그대로 유지된다.

이 셋이 겹치면 「운영자 제출 미기록」은 코드에는 있으되 값은 안 변하는 수정이 된다.

권장(둘 다):

1. **컨트롤러 조립 테스트** `game/feature/src/test/kotlin/com/kgd/game/presentation/play/controller/GameScoreControllerTest.kt`
   — `PrivateGameGateControllerTest.kt:37-44` 방식 그대로: Spring 없이 `GameScoreController(GameScoreService(mock gameRepo, mock scoreRepo), mock)`
   를 생성자로 조립하고 `submit(slug, userId, ua, roles, request)` 를 직접 부른다. 판정은 **`scoreRepository.submit` 호출 여부**와 응답 `excluded`.
   - `ua = "…HeadlessChrome/153.0.0.0…"`(실측값), `roles = null` → `verify(exactly = 0) { submit }`, `excluded == true`
   - 사람 UA, `roles = "ROLE_USER,ROLE_ADMIN"` → 같음
   - 사람 UA, `roles = "ROLE_USER"` → `verify(exactly = 1) { submit }`, `excluded == false`
   - `roles = null`(게이트웨이가 익명 통과 시 헤더를 지운다, `AuthenticationGatewayFilter.kt:86-89`) → 기록됨
   실제 `CrawlerUserAgents` 와 실제 서비스를 끼우므로 배선·파서·서비스가 한 검사에서 포트 호출로 재진다.
   test-rules 의 mock 경계(Outbound Port 만)도 지킨다.
2. **운영 운영자 프로브(V4b)** — 헤드리스가 아니라 **사람 UA + 운영자 Bearer** 로 한 번:
   `curl -A "<사람 UA>" -H "Authorization: Bearer <ROLE_ADMIN 토큰>" -X POST https://game.1989v.com/api/v1/games/<slug>/scores …`
   → 응답 `excluded=true`, 보드 GET 에 닉 없음, `kubectl logs deploy/content` 에 `operator=true` 줄.
   같은 curl 을 **`ROLE_USER` 토큰**으로 한 번 더 → `applied=true` 여야 한다(사람을 거르지 않는지). 그 행은 V6 정리 대상에 넣는다.
   이 프로브만이 R2 를 R1 과 분리해 잰다.
3. **R4 는 실제 게임 한 판**으로 — `auth.js`+`rank.js` 를 둘 다 싣는 게임(예 `archer-outbreak`) 을 운영자 로그인 상태의
   **일반 브라우저**에서 한 판 끝내고 ① 위젯 문구가 `운영·자동화 기록 — 랭킹에 오르지 않음` ② 그 요청의
   요청 헤더에 `Authorization` 이 실렸는지(DevTools Network) ③ 파드 로그 `operator=true` ④ 보드에 닉 없음. 눈으로 본 문구(①)가
   아니라 ②③④가 근거다. 헤드리스로 대신하면 UA 가 먼저 걸려 ③ 이 `automation=true` 로 나와 R4 를 증명 못 한다.

### F3 (REVISE) — V4 의 「뒤집기」는 맞지만 세 가지가 스펙에 없다

「배포 전 새 판정으로 빨간불 → 배포 후 초록」(`spec.md:110`, `test-quality.md:7`)은 옛 서버를 회귀 상태로 쓰는 진짜
주입이고, 두 판정(`excluded === true`·닉 없음) 모두 옛 서버에서 빨갛게 나온다(필드 없음 · 닉 있음). 다음을 적어야 구현이 흔들리지 않는다.

- **응답을 붙잡는 방법.** `cdp-page.mjs:25-26` 은 `Page`·`Runtime` 만 켜고 `Network` 도메인이 없으며 `events`(`:20`)는 메서드당 핸들러
  하나다. 「`Network`/`fetch`」(`spec.md:81`) 중 하나를 고르라. 가장 짧은 것은 `.practice` 클릭 **전에** `Runtime.evaluate` 로
  `window.fetch` 를 감싸 `/scores` POST 응답 JSON 을 `window.__scoreResp` 에 남기는 것 — 게임의 실제 제출 경로(`score.ts:49`)를
  그대로 지나므로 스크립트가 따로 제출하지 않는다. 스크립트가 직접 `fetch` 로 POST 하면 **게임이 아니라 검사가 만든 제출**을 재게 된다.
- **`noteRank`(`e2e-prod-score.mjs:27`) 의 운명.** 아레나는 재게시하지 않으므로(`key-decisions.md:10`) 배포 후 결과 화면은 옛
  `scoreNote`(`score.ts:61`)가 `연습 순위표 0위 · N점 (최고 기록 유지)` 를 그린다. 지금 정규식 `^연습 순위표 \d+위 · \d+점` 은
  `0위` 에도 맞아 **통과하지만 뜻이 없다.** 지우든지, 「재게시 전까지 `0위` 자리표시」로 고정 단언하든지 스펙에 적는다.
  안 적으면 구현자가 문구를 고치려 아레나를 재게시한다(범위 밖).
- **빨간불 실행이 행을 하나 더 만든다.** 옛 서버에 새 스크립트를 돌리면 `실측NNNNNN` 이 보드에 오른다 — 그게 빨간불의 근거다. 이 행은
  V6 정리 조건(`LIKE '실측%'`)에 잡히지만 **순서**가 있다(F4).

### F4 (REVISE) — V4 빨간불 · V6 정리 · V4 초록불의 순서를 못 박아라

V6(`spec.md:112`)은 「정리 뒤 `COUNT = 0`, 남은 행 19」다. V4 의 빨간불 실행(옛 서버)이 정리 **뒤**에 돌면 `실측` 행이 다시 생겨
V6 의 0 이 거짓이 된다. 순서: ① 새 스크립트로 옛 서버 → 빨간불(행 +1) ② 배포 ③ 같은 스크립트 → 초록(행 +0) ④ F2-2 프로브
(ROLE_USER 행 +1) ⑤ V6 미리보기(ROLLBACK) → DELETE → COUNT 0. 예상 `game_score` 삭제 행은 17 이 아니라 **17 + ① + ④** 가 된다 —
「미리보기 행 수를 그대로 기록」(`spec.md:93`) 원칙이 있으니 숫자보다 순서를 적으면 된다.

### F5 (minor) — V2 의 HeadlessChrome 케이스를 실측 문자열로

`CrawlerUserAgentsTest.kt:14` 는 손으로 적은 `HeadlessChrome/120.0` 이다. common 으로 옮기는 김에 위 실측 UA(153) 를 케이스에
넣고 주석에 「`cdp-chrome.sh --headless=new` 실측 2026-09-20」을 남기면, 검사가 자기 이름이 아니라 실제 도구가 보내는 값을 잰다.
분류는 바뀌지 않으므로 선택.

### F6 (minor) — V1 「둘 다 false → 기존 계약 그대로」 는 반환 타입이 바뀌므로 문자 그대로가 아니다

`SubmitGameScoreUseCase.kt:9` 는 `Pair<Boolean, Int>`, 기존 테스트 `GameScoreServiceTest.kt:304,307,322,325` 는 `(true to 1)` 을
단언한다. `Result` 로 바꾸면 이 넷은 컴파일이 깨지므로 놓칠 수는 없지만, V1 문구를 「`Result(true, 1, excluded=false)`,
`submit` 1회」로 고쳐 두면 「기존 계약」이 무엇인지 남는다. 컨트롤러의 위치 분해(`GameScoreController.kt:53`)도 `Result` 필드명으로
바꾸는 것이 스펙 `spec.md:61` 의 「위치 분해를 쓰지 않는다」 취지에 맞다.

### F7 (info) — V5 는 성립한다. 파드 이름만 적어라

`content` 호스트에 로그 레벨 오버라이드가 없어(`content/app/src/main/resources/application*.yml`, `k8s/base/content/deployment.yaml`)
`log.info` 는 나온다. 스펙 헤더의 code-dictionary 는 옛 이름이고 실제 파드는 `content`(`settings.gradle.kts:52-53`, `deployment.yaml:4`).
V5 를 `kubectl logs deploy/content | grep 'score excluded'` 로 적고, F2-2 프로브까지 하면 `automation=true` 와 `operator=true`
**두 줄**이 각각 찍혀야 통과다 — 한 줄만 있으면 R2 가 죽어 있는 신호다.

## 괜찮은 것 (바꾸지 말 것)

- V1 의 판정 근거를 응답 필드가 아니라 `verify(exactly = 0) { scoreRepository.submit }` 로 둔 것(`test-quality.md:5`) — 저장이
  새는데 응답만 맞는 회귀를 잡는다.
- 닉네임 접두로 거르지 않는 결정(`spec.md:25-26`) — 검사가 자기 이름을 재는 함정을 스펙이 먼저 막았다.
- `excluded` 를 200 으로 둔 것 — V4 가 `r.ok` 분기(`score.ts:51`)에 걸리지 않아 응답 본문을 그대로 잰다.
- 판별기를 `object` 로 두고 common 으로 옮기는 것 — V2 가 Spring 없이 도는 순수 단위로 남는다.

## 요청하는 스펙 수정 (요약)

1. V1 에 「제외 대상 + 규격 밖 입력 → 400」 케이스 추가 (F1)
2. `GameScoreControllerTest`(생성자 조립, 실제 서비스·판별기, 포트 호출로 판정) 를 V1 옆에 V1b 로 추가 (F2-1)
3. V4b: 사람 UA + ROLE_ADMIN Bearer curl → `excluded`, 같은 curl ROLE_USER → `applied` (F2-2); R4 는 auth.js+rank.js 게임 한 판, 근거는 요청 헤더·파드 로그·보드 (F2-3)
4. V4 에 응답 포착 방식과 `noteRank` 처리 명시 (F3)
5. V4 빨간불 → 배포 → 초록 → 프로브 → V6 순서 명시, 삭제 예상 행 수는 미리보기 기준 (F4)
6. V5 에 파드 이름 `content` 와 「`automation`·`operator` 두 줄」 (F7)

## Round 2 (2026-09-20)

**Verdict: SHIP** — F1~F7 전부 반영됐다. 아래 셋은 구현 중 고치면 되는 문구 수준이고 재리뷰가 필요 없다.

| 1회차 | 반영 위치 | 판정 |
|---|---|---|
| F1 검증이 제외보다 앞선다 | `spec.md:173` V1 ④ `isAutomation=true` + 닉 1자 → `BusinessException(INVALID_INPUT)` | 해결 |
| F2 컨트롤러 배선 · 운영자 끝-끝 · rank.js Bearer | `spec.md:175` V3 조립 테스트 4케이스(실제 서비스·실제 판별기·포트만 mock·포트 호출로 판정) · `spec.md:179` V7 일반 브라우저 한 판 + `ROLE_USER` curl 대조 · `spec.md:108-114` auth.js 미탑재 22종에 한 줄 · `key-decisions.md:13,16` | 해결 |
| F3 응답 포착 · `noteRank` · 빨간불 행 | `spec.md:128-132` `.practice` 클릭 전 `window.fetch` 감싸기(게임의 실제 제출 경로, `score.ts:49` 가 전역 `fetch` 를 부르므로 감싸기가 먹는다) · `noteRank` 는 「`${expectScore}점` 포함」 · `spec.md:151-152` | 해결 |
| F4 순서 | `spec.md:151-152` 정리는 배포·e2e·프로브 뒤 마지막, 삭제 행 = 17 + 추가분 · `test-quality.md:11` | 해결 |
| F5 실측 UA | `spec.md:47-48`, `spec.md:174` V2 | 해결 |
| F6 `Result` 단언 | `spec.md:87` 단언 두 줄 교체(`GameScoreServiceTest.kt:307,325`; mock 반환 `:304,322` 는 포트가 `Pair` 그대로라 유지) · `spec.md:92` 위치 분해 대신 필드명 | 해결 |
| F7 파드 이름 · 두 줄 | `spec.md:82` 로그 리터럴 고정 · `spec.md:177` V5 `automation=true` + content Synced · `spec.md:179` V7 `operator=true` | 해결 |

남은 문구 수정 (비차단):

1. `spec.md:179` V7 ② 「그 닉으로 `SELECT COUNT(*)` 변화 없음」은 **행이 없는 새 닉**일 때만 뜻이 있다. `game_score` 는 닉당 한 행
   upsert 라 이미 행이 있는 닉(`go` 등)은 제외되지 않아도 행 수가 그대로다(최고 갱신은 `score`·`updated_at` 만 바뀐다). 「새 닉으로」를
   붙이거나 `updated_at` 무변화를 함께 보라. ①(파드 로그 `operator=true`)이 주근거라 판정은 성립하지만, ② 가 초록인 이유가 하나여야 한다.
2. `spec.md:151` 「V4 빨간불 실행」→ 지금 번호로는 **V5** (V4 는 컴파일). `test-quality.md:11` 「배포 → 빨간불/초록불 e2e」는 빨간불이
   **배포 전**이라는 `spec.md:177` 과 어긋난다 — 「빨간불 → 배포 → 초록불 → 프로브 → 정리」로.
3. `spec.md:164` 「백엔드(code-dictionary 이미지)」— 실제 이미지는 `commerce/content`(`k8s/base/content/deployment.yaml:24`,
   `k8s/overlays/oci-arm/kustomization.yaml:369-370`). 배포 순서 메모가 없는 이미지를 가리킨다.

정보: `lib/rank.js` 를 싣는 `index.html` 은 80개, 그중 `auth.js` 없는 것 22개(`spec.md:108` 의 74 는 집계 기준이 다른 듯하나 22 목록은 일치).
