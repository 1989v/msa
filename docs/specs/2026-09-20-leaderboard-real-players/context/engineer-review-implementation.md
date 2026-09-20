# Engineer Review — implementation

- 대상: `docs/specs/2026-09-20-leaderboard-real-players/spec.md` (+ `planning/requirements.md`, `context/key-decisions.md`)
- 판정: **REVISE** (1회차) → **SHIP** (2회차, 아래 「Round 2」)
- 검토일: 2026-09-20
- 기준: `hns` implementation checklist + `references/review-protocol.md`, 레포 표준(`docs/conventions/logging.md`, `docs/conventions/blog-writing.md` §DB 반영, `game/CLAUDE.md`), 볼트 [[anonymous-identity-headers]] (1989v, updated 2026-09-10)

## 요약

스펙이 가리키는 클래스·라우트·헤더·의존성은 전부 실재하고, 핵심 전제(게이트웨이가 `X-User-Roles` 를 서버 값으로 덮어쓴다 · 헤드리스 크롬 UA 가 `isCrawler` 에 걸린다 · 쓰기 경로가 하나뿐이다)는 코드와 실측으로 확인됐다.
막는 결함은 없다. 다만 구현자가 그대로 따르면 **정리 SQL 이 0행을 지우고(R7)**, **운영자 판별이 22개 게임에서 동작하지 않으며(R2)**, **e2e 의 노트 검사가 반대 의미로 초록불(R6)** 이 나는 세 곳이 있어 스펙 문장을 고쳐야 한다. 나머지는 구현자가 헤맬 자리를 문장 하나로 메우는 것들이다.

## 확인된 것 (스펙 주장 ↔ 코드)

| # | 스펙 주장 | 근거 |
|---|---|---|
| C1 | `SubmitGameScoreUseCase.execute` 가 `Pair<Boolean, Int>` 를 돌려주고, 이를 `Result` 로 바꾼다 | `game/feature/src/main/kotlin/com/kgd/game/application/play/usecase/SubmitGameScoreUseCase.kt:9`, `…/service/GameScoreService.kt:60` |
| C2 | 검증 뒤·저장소 앞에 끼울 자리가 있다 | `GameScoreService.kt:65-69` (NICK_REGEX·MAX_SCORE 검사 → `scoreRepository.submit`) |
| C3 | `ScoreSubmitResponse(applied, rank)` 에 `excluded` 를 더한다 | `…/presentation/play/controller/GameScoreController.kt:38`, 위치 분해 `:53` |
| C4 | `isOperator` 는 `roles.split(",").any { trim == "ROLE_ADMIN" }` | `…/presentation/suggestion/controller/GameSuggestionController.kt:150-151` |
| C5 | 게이트웨이 `game-score-submit` 이 `optionalUserConfig()` 로 헤더를 서버 발행값으로만 넣는다 | `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:294-301`; `…/filter/AuthenticationGatewayFilter.kt:77-78` (`X-User-Roles` 주입 = 덮어쓰기), `:86-89` (익명 통과 시 두 헤더 제거). 라우트 순서도 카탈로그 캐치올(`:353`)보다 앞이다 — [[anonymous-identity-headers]] 「캐치올」 절과 일치 |
| C6 | JWT `roles` 에 `ROLE_ADMIN` 문자열이 실린다 | `common/src/main/kotlin/com/kgd/common/security/JwtUtil.kt:20`, `auth/domain/src/main/kotlin/com/kgd/auth/domain/role/model/Role.kt:4` |
| C7 | 헤드리스 크롬(`--headless=new`) UA 가 크롤러로 잡힌다 | `scripts/cdp-chrome.sh:83` 가 `--headless=new` 로 띄운다. **실측**: `cdp-chrome.sh start` 후 `/json/version` → `User-Agent: Mozilla/5.0 (Macintosh; …) HeadlessChrome/153.0.0.0 Safari/537.36` → `CrawlerUserAgents.kt:25` 마커 `headlesschrome` 히트. 크롬은 같은 명령 안에서 `stop` 했다 |
| C8 | `@RequestHeader("User-Agent")` 가 이 코드베이스 방식인가 | 같은 호스트(content)의 형제 컨트롤러가 `@RequestHeader(value = HttpHeaders.USER_AGENT, required = false)` 다 — `blog/feature/src/main/kotlin/com/kgd/blog/presentation/controller/BlogPageController.kt:34`, `deal/feature/…/DealRedirectController.kt:34`. analytics 의 `servletRequest.getHeader` (`EventCollectController.kt:45`) 는 소수 방식. **`@RequestHeader` 가 맞고, 상수는 `HttpHeaders.USER_AGENT` 로** |
| C9 | `common` 의존 | `analytics/app/build.gradle.kts:10`, `game/feature/build.gradle.kts:13` 둘 다 `implementation(project(":common"))`. kotest 러너는 루트 `build.gradle.kts:69-71` 이 전 서브프로젝트에 건다 → 테스트를 `common/src/test/kotlin/com/kgd/common/web/` 로 옮겨도 돈다 |
| C10 | `CrawlerUserAgents` 의 다른 사용처 | origin/main 에서 `EventCollectController.kt:3` import 한 줄뿐. 문서 참조 없음 |
| C11 | `GameAuth.token()` 전역 | `portal-fe/public/games/lib/auth.js:37` `window.GameAuth = { token }`; `rank.js:102-117` `postScore` 가 헤더에 `Authorization` 을 안 싣는다 |
| C12 | 정리 대상 테이블·컬럼 | `game/feature/src/main/resources/gamedb/migration/V15__game_score.sql:5`, `V49__game_score_daily.sql:35` (둘 다 `nickname VARCHAR(24)`); DB 는 `game_db` (`k8s/base/content/deployment.yaml:63`) |
| C13 | `game_score` 쓰기 경로가 제출 하나뿐 (조회 경로를 안 건드려도 새지 않는다) | `GameScoreRepositoryPort` 사용처는 `GameScoreService.kt:27` 과 어댑터 `SaveAdapters.kt:118` 뿐. 아케이드 `/arcade/scores` 는 세션·리플레이 테이블(`GameUseCases.kt:103-125`) |
| C14 | 캔버스 게임이 응답의 `rank=0` 을 화면에 흘리지 않는다 | `GameRank.submit(...).then` 을 쓰는 5곳이 전부 `r.applied` 또는 `res.rank` 로 가드 (`spud-arena/index.html:726`, `nether-return/js/game.js:1040`, `abyss-drill/index.html:522`, `rift-front/index.html:1391`, `cliff-climber/index.html:714`) |
| C15 | e2e 가 제출 응답을 잡을 수 있는가 | 배포 번들 `portal-fe/public/games/arena/assets/index-CjJOLYZk.js` 는 호출 시점의 전역 `fetch` 를 쓴다(`await fetch(\`/api/v1/games/${yd}/scores\`…)`) → `window.fetch` 패치 가능. `amp-arena/tools/cdp-page.mjs:20` `events` 맵 + 공개 `send`(`:33`) 로 CDP `Network` 도 가능 |

## 고쳐야 할 것 (REVISE)

### I1. 정리 SQL 의 한글 리터럴은 `oci-mysql` 경로에서 매치되지 않는다 — R7 이 0행을 지운다

- 스펙: `nickname LIKE '실측%' OR nickname IN ('진행실측', 'zz-e2e-probe', '00')` (`spec.md` §데이터 정리)
- 근거: `~/.local/bin/oci-mysql:44` 는 `mysql -uroot --table` 을 charset 지정 없이 실행한다. 레포가 같은 경로의 사고를 기록해 뒀다 — `docs/conventions/blog-writing.md:164-165` 「`oci-mysql` 경유 접속의 클라이언트 charset 이 latin1 이라, 한글을 리터럴로 넣으면 조용히 이중 인코딩된다 (2026-08-24 실제 발생)」. 조회·삭제도 같은 변환을 타므로 `'실측%'` 는 다른 바이트열이 되어 **미리보기가 0행**으로 나온다. 도구가 ROLLBACK 미리보기를 먼저 보여주니 실수로 지우지는 않지만, 「이미 깨끗하다」로 오독할 수 있다.
- 수정: 스펙의 SQL 을 hex 로 바꾼다 (레포 규칙 `blog-writing.md:161`, `.claude/skills/blog-post/SKILL.md:78`).
  ```sql
  nickname LIKE CONCAT(CONVERT(0xEC8BA4ECB8A1 USING utf8mb4), '%')
  OR nickname IN (CONVERT(0xECA784ED9689EC8BA4ECB8A1 USING utf8mb4), 'zz-e2e-probe', '00')
  ```
  그리고 V6 에 「미리보기 행 수가 17 이 아니면(특히 0 이면) 실행하지 않는다 — charset 불일치다」 한 줄. `SELECT COUNT(*)` 검증 쿼리도 같은 hex 를 쓴다.

### I2. R2(운영자 판별)는 캔버스 게임 74종 중 22종에서 동작하지 않는다 — 스펙이 이를 수치로 밝히고 결정해야 한다

- 스펙: 「`auth.js` 를 안 싣는 게임에서는 `GameAuth` 가 없으므로 지금처럼 게스트 제출이다」 (`spec.md` §portal-fe) · 「R4 — R2 가 캔버스 게임에서 실제로 동작하기 위한 전제」 (`requirements.md` R4) · 사용자 결정 「테스트는 로그인 상태로 한다」 (`key-decisions.md`)
- 근거: `portal-fe/public/games/**/index.html` 중 `lib/rank.js` 를 싣는 게시 페이지 **74개**, 그중 `lib/auth.js` 도 싣는 것 **52개**, 안 싣는 것 **22개** (`acid-rain`·`alley-pool`·`beat-dojo`·`block-burst`·`breeze-links`·`cog-foundry`·`crate-shift`·`crimson-ravine`·`drift-continent`·`element-pilgrim`·`hand-alchemy`·`mine-pioneer`·`number-garden`·`pixel-mine`·`quad-weave` 외 7). 이 22종에서는 로그인해도 `Authorization` 이 안 실려 `X-User-Roles` 가 비고, 운영자 플레이가 그대로 기록된다 — 「로그인 상태로 테스트한다」는 결정이 이 게임들에선 효력이 없다.
- `rank.js` 가 쿠키를 직접 읽는 것은 답이 아니다 — 루트 `CLAUDE.md` 「토큰을 읽는 곳을 늘리지 않는다 — 지금은 `lib/auth.js` 하나가 읽는다」. 스펙의 `GameAuth` 의존은 옳다.
- 수정(둘 중 하나를 스펙에 적는다): (a) 22개 `index.html` 에 `<script src="../lib/auth.js"></script>` 를 `rank.js` 앞에 한 줄씩 넣는다(범위 확장 — 사용자 확인 필요), 또는 (b) 지금 범위를 유지하되 `game/CLAUDE.md` Key Rules 에 「auth.js 를 안 싣는 22종에선 운영자 판별이 없다 — 그 게임의 테스트는 별도 닉으로」 를 적는다. 어느 쪽이든 **숫자를 스펙에 남긴다**.

### I3. `e2e-prod-score.mjs` 의 `noteRank` 검사가 뒤집힌 뒤에도 남는다 — 배포 번들은 「0위」를 찍고 검사는 초록불

- 스펙: R6 은 `excluded === true` 와 「보드에 닉 없음」만 말한다. `checks.noteRank` (`amp-arena/tools/e2e-prod-score.mjs:27`, 정규식 `/^연습 순위표 \d+위 · \d+점/`) 는 언급이 없다.
- 근거: 아레나는 재게시하지 않으므로(`key-decisions.md`) 배포 번들 `index-CjJOLYZk.js` 의 `scoreNote` 가 그대로 돈다 — `applied=false, rank=0` 이면 문자열은 `연습 순위표 0위 · N점 (최고 기록 유지)` (`amp-arena/client/src/platform/score.ts:61` 과 동일). 정규식은 `0위` 에도 매치되어 **「순위표에 올랐다」는 검사가 초록불**이고, 반대로 스펙대로 `score.ts` 를 고쳐 다음에 게시하면 노트가 `연습 기록 N점 · 운영·자동화 기록은 …` 이 되어 같은 검사가 **빨간불**로 바뀐다.
- 수정: 스펙 §amp-arena 에 ① `noteRank` 를 「노트에 `${expectScore}점` 이 있다」(두 번들 모두 참) 로 바꾼다 ② 재게시 전까지 운영 아레나 결과 화면이 `0위 (최고 기록 유지)` 로 보인다는 사실을 범위 밖 항목에 적는다 — 알고 두는 것과 나중에 버그로 발견하는 것은 다르다.

### I4. 제출 응답을 잡는 방법이 「`Network`/`fetch`」로 열려 있다 — 하나로 정하고, 「없음」 검사에 양성 대조를 붙인다

- 스펙: `spec.md` §amp-arena R6 「`Network`/`fetch` 로 붙잡아」
- 근거: `cdp-page.mjs` 에는 `Network.enable` 이 없다. CDP 로 가면 `Network.enable` → `Network.responseReceived`(url 이 `/scores` 로 끝나는 requestId) → `Network.loadingFinished` 를 기다린 뒤 → `Network.getResponseBody` 세 단계다(`responseReceived` 직후에 부르면 본문이 비거나 실패한다). `fetch` 패치는 `.practice` 클릭 전에 `page.eval` 로 `window.fetch` 를 감싸 `/scores` 응답을 `r.clone().json()` 으로 `window.__scoreResp` 에 두면 끝이다 — 번들이 호출 시점의 전역 `fetch` 를 쓰는 것을 확인했다(C15).
- 수정: 스펙에 `fetch` 패치를 명시한다(6줄, 새 CDP 도메인 없음). 그리고 `onLeaderboard` 를 뒤집을 때 `parsed.success === true` 를 함께 검사한다 — 보드 요청이 실패해 빈 배열이 와도 「닉이 없다」는 참이 되어 통과한다. 양성 대조(`excluded === true`)는 있으니 음성 검사의 전제만 막으면 된다.

### I5. 구현 베이스가 이 워킹트리의 `main` 이면 옮길 파일이 git 에 없다

- 근거: `/Users/gideok-kwon/IdeaProjects/msa` 의 `main` 은 `origin/main` 대비 **ahead 123 · behind 182** (`git status -sb`). `analytics/app/src/main/kotlin/com/kgd/analytics/presentation/event/` 전체가 여기서는 **untracked**(`??`) 이고 `git ls-tree HEAD` 에 `CrawlerUserAgents` 가 없다. 반면 `origin/main`(`d2e00420`) 에는 커밋돼 있고(`36858ac5`, `a7e28265`), 이 트리의 untracked 사본과 내용이 같다. 스펙이 손대는 나머지 파일(서비스·컨트롤러·테스트·rank.js·auth.js·score.ts·e2e·ADR-0084·common-features.md)은 HEAD 와 origin/main 이 동일하고 `game/CLAUDE.md` 만 1줄 차이다.
- 수정: 스펙 상단에 「베이스 = `origin/main`, 별도 worktree 에서 작업」 한 줄. 공유 트리에서 `git mv` 를 시도하면 실패하고, `git add -A` 는 남의 untracked 파일을 실어 간다 (메모리 `shared-worktree-use-own-worktree`).

### I6. 로그 문구를 고정한다 — V5 가 그 문자열을 grep 한다

- 스펙: §game 「제외 시 `log.info` 한 줄 (slug·닉·operator/automation)」, V5 「`kubectl logs` 에 `score excluded` 한 줄」
- 근거: 검사가 찾는 문자열이 구현 문장에 없다. `GameScoreService` 에는 아직 로거가 없다(`KotlinLogging` 미사용, 의존성은 `game/feature/build.gradle.kts:22` 에 있음).
- 수정: 문구를 스펙에 적는다 — `log.info { "score excluded slug=${command.slug} nick=$nick operator=${command.operator} automation=${command.automation}" }` (`docs/conventions/logging.md` 람다 형식). V5 는 이 리터럴로 grep.

### I7. 테스트·타입 세부 — 구현자가 컴파일 에러로 알게 될 것들을 미리 적는다

- `GameScoreServiceTest.kt:307`, `:325` 의 `shouldBe (true to 1)` → `shouldBe SubmitGameScoreUseCase.Result(true, 1)`. `:304`, `:322` 의 `returns (true to 1)` 는 **그대로** — 포트(`SavePorts.kt:49-62`)는 Pair 를 유지한다. 서비스는 `val (applied, rank) = scoreRepository.submit(...)` 로 받아 `Result` 로 감싼다.
- 중첩 `Result` 는 서비스 안에서 반드시 `SubmitGameScoreUseCase.Result(...)` 로 한정한다 — 맨 `Result(...)` 는 `kotlin.Result` 로 풀려 컴파일이 안 된다. 선례 `RosterService.kt:42-43`.
- 컨트롤러 `:53` 의 `val (applied, rank) =` 위치 분해는 `excluded` 를 못 싣는다 — 이름 접근으로 바꾼다(스펙 §game 의 「위치 분해를 쓰지 않는다」 주석과도 맞다).
- 새 테스트 둘(`operator=true`·`automation=true`)은 `every { scoreRepository.submit(...) }` 를 **선언하지 않는다** — MockK 는 스텁 없는 호출에 예외를 던지므로 `verify(exactly = 0)` 이전에 「호출되면 죽는다」가 한 겹 더 된다. `gameRepository.findBySlug` 는 스텁한다(`resolveGameId` 가 먼저 돈다).

### I8. `common-features.md` 「항상 로드」 표의 활성화 열이 `scanBasePackages` 다

- 근거: `docs/architecture/common-features.md:10` 행의 활성화 방식이 「`scanBasePackages`에 포함」. `CrawlerUserAgents` 는 빈이 아닌 `object` 라(스펙도 그렇게 적었다) 같은 행에 얹으면 문서가 틀린다.
- 수정: 별도 행 「`CrawlerUserAgents` (`com.kgd.common.web`) | 일반 `object` — import 만, 스캔 무관」.

## 참고 (수정 불요, 기록만)

- `X-User-Roles` 파싱이 `GameSuggestionController.isOperator` 와 두 번째 사본이 된다. Rule of Three 미만이라 지금은 복제가 맞다. 세 번째가 생기면 `game/presentation` 공용으로.
- `@Transactional` 메서드 안의 조기 반환은 쓰기 없이 커밋된다 — 문제없다. 동시성 제어(닉네임 유니크 키 업서트, `V15:10`·`V49:40`)는 이 스펙이 건드리지 않는다.
- NFR: 제외 로그는 운영자 플레이·e2e 실행 횟수만큼이라 부하가 아니다. N+1·무제한 조회 없음.
- 마이그레이션·롤백: 스키마 변경 없음. 롤백은 이미지 되돌리기. 데이터 정리만 비가역 — 도구의 ROLLBACK 미리보기(I1 의 행 수 대조)가 안전장치다.
- V4 「게이트 전 빨간불」은 실제로 빨갛다 — 현재 응답에 `excluded` 필드가 없어 `=== true` 가 거짓이다.
- `docs/doc-index.lock.json` 이 스펙 헤더의 `common/…/web/CrawlerUserAgents.kt` 를 구현 전까지 dangling 으로 보고할 수 있다 — 검증 아티팩트이지 SOT 가 아니다(`docs/standards/doc-index-tracking.md:22`).

## 체크리스트

- [x] Referenced classes/modules exist — C1~C13 (단, 베이스 트리 주의 I5)
- [x] No conflicts with existing code — 쓰기 경로 하나(C13), 라우트 순서(C5)
- [x] Complexity risks identified — I2(적용 범위), I3(검사 반전)
- [x] No NFR anti-patterns — 해당 없음
- [x] Migration/rollback — 스키마 없음, 데이터 정리는 미리보기 대조(I1)
- [x] Concurrency safety — 변경 없음

## Round 2 (2026-09-20) — 판정: **SHIP**

1회차 I1~I8 을 개정판(`spec.md`·`requirements.md`·`key-decisions.md`·`test-quality.md`)과 대조했다. 새로 들어온 사실 주장은 코드로 다시 확인했고 재검토는 하지 않았다.

| # | 상태 | 근거 |
|---|---|---|
| I1 정리 SQL charset | **해소** | `spec.md:140-152` — `SET NAMES utf8mb4;` 선행 + 행 수로 매치 확인(0 이면 hex) + **id 목록으로 DELETE**. `~/.local/bin/oci-mysql:33-46` 은 SQL 을 base64 로 실어 `mysql` **stdin 배치**로 넣으므로 다중 문장이 되고, UTF-8 바이트가 그대로 서버에 닿아 `SET NAMES` 가 클라이언트 latin1 선언을 덮는다. 삭제는 id 라 charset 과 무관. 1단계의 표 대조(`:147`)가 「0행이 아니라 엉뚱한 행」까지 잡는다 — 충분하다 |
| I2 auth.js 없는 22종 | **해소** | `spec.md:108-114` 목록 22개가 재계산 결과와 **정확히 일치**(차집합 양쪽 ∅). 22종 모두 `#codeInput`/`#codeShow` 없음 확인(재계산 ∅). `autoPanel` 46 · `platform.js` 28 = 74 도 일치 |
| I3 `noteRank` | **해소** | `spec.md:132` 「`${expectScore}점` 포함」, `:123-125` 및 `key-decisions.md:10` 에 재게시 전 「0위」 표시 명기 |
| I4 캡처 방법 | **해소** | `spec.md:128-131` fetch 패치(클릭 전, `window.__scoreResp`) + 보드 GET `success === true` 전제 |
| I5 베이스 트리 | **해소** | `spec.md:7-8` |
| I6 로그 리터럴 | **해소** | `spec.md:79-83`, `nick` 은 서비스에 이미 있는 지역변수(`GameScoreService.kt:63`) |
| I7 타입·테스트 | **해소** | `spec.md:85-87`(`SubmitGameScoreUseCase.Result` 한정, 포트 Pair 유지, 단언 두 줄), `:92`(위치 분해 제거), V1 ①②(`every` 미선언). 필드명 `isOperator`/`isAutomation` 은 `ReplyToGameSuggestionUseCase.kt:13` 과 같다. 신규 V3 의 본보기 `PrivateGameGateControllerTest.kt:31-41` 은 실제로 Spring 없는 생성자 조립이다 |
| I8 common-features 행 | **해소** | `spec.md:161-163` 별도 행. `common/docs/service.md:16` Provided Components 표 실재 |

새 주장 확인: V64 `member_id` (`V64__game_score_member.sql:10`) · 액세스 토큰 1시간 (`auth/app/src/main/resources/application.yml:52` `access-expiry: 3600`) · `docs/context-map.md` 에 game 행 없음 — 전부 맞다.

남은 것 (비차단, 문구 하나):
- `spec.md:164-165` 「백엔드(code-dictionary 이미지)」 — game:feature 를 싣는 이미지는 **content** 다 (`content/app/build.gradle.kts:14` co-deploy, `k8s/base/content/deployment.yaml:24` `commerce/content:latest`). 같은 스펙의 V5(`:177`)는 이미 「portal-fe·content 둘 다 Synced」로 맞게 적었다. 한 단어 교체.
