<!-- source: game/feature/src/main/kotlin/com/kgd/game/application/play/service/GameScoreService.kt -->
<!-- source: game/feature/src/main/kotlin/com/kgd/game/presentation/play/controller/GameScoreController.kt -->
<!-- source: portal-fe/public/games/lib/rank.js -->
<!-- source: common/src/main/kotlin/com/kgd/common/web/CrawlerUserAgents.kt -->
# 게임 랭킹에 실제 플레이어 기록만 남긴다

작업 베이스: `origin/main`, **별도 worktree**. 공유 트리의 `main` 은 origin 과 갈라져 있고(ahead 123 ·
behind 182) `analytics/.../presentation/event/` 가 untracked 라 여기서는 `git mv` 가 안 된다.

## Goal

`POST /api/v1/games/{slug}/scores` 가 **운영자 로그인 제출**과 **자동화(헤드리스·크롤러) 제출**을
기록하지 않는다. 응답은 성공이되 `excluded=true` 로 그 사실을 밝힌다. 기존에 쌓인 시험 기록은
일회 정리한다. 아케이드 보드(`/api/v1/games/arcade/scores`, 세션 토큰 + 리플레이 검증)는 신뢰
모델이 달라 범위 밖이다.

## 규칙

| 제출자 | 판별 | 결과 |
|---|---|---|
| 자동화 | `User-Agent` 가 `CrawlerUserAgents.isCrawler()` — HeadlessChrome·크롤러·`(compatible; …)`·UA 없음(게이트웨이 뒤에서는 `ReactorNetty` 마커가 잡는다) | 기록 안 함, `excluded=true` |
| 운영자 | 게이트웨이가 넣은 `X-User-Roles` 에 `ROLE_ADMIN` | 기록 안 함, `excluded=true` |
| 그 외 | — | 지금과 같다 (`applied`, `rank`) |

**`excluded` = 기록 대상이 아닌 제출.** `applied`(자기 최고를 넘겼는가)와 독립인 축이다. `excluded` 일 때만
`rank=0` 이 나간다 — 지금까지 `rank` 는 항상 1 이상이었다.

두 판별은 **제출 경로에서만** 본다. 조회 경로는 손대지 않는다 — 행이 안 쓰이면 걸러 낼 것도 없다
(`GameScoreRepositoryPort.submit` 한 호출이 역대·오늘 보드를 함께 쓰므로 건너뛰면 둘 다 건너뛴다).
숨김 컬럼 방식(쓰되 조회에서 제외)은 고르지 않는다: 조회 지점이 `top`·`topDaily`·`activeBoards`·
`rankOf`·내 기록 다섯이라 하나만 빠져도 시험 기록이 새고, 스키마 변경이 든다.

닉네임 접두(`실측`)로 거르지 않는다 — 검사가 자기 이름을 재는 것이고 다음 스크립트가 다른 이름을
쓰면 끝난다.

운영자 판별의 **한계**(둘 다 문서에 적는다):
- 게스트 상태의 운영자는 구별할 수 없다 → 테스트는 로그인 상태로.
- 액세스 토큰은 1시간이고 게임 안에는 재발급이 없다(`lib/auth.js` 는 쿠키를 읽기만 한다). 상세 페이지를 연
  지 1시간이 지난 제출은 게이트웨이 optional 필터가 익명으로 통과시켜 **게스트로 기록된다**.

## 변경

### common — 판별기 이동 (R5)

`analytics/app/.../presentation/event/CrawlerUserAgents.kt` → `common/src/main/kotlin/com/kgd/common/web/CrawlerUserAgents.kt`
(패키지 `com.kgd.common.web`, 내용 그대로). 테스트도 `common/src/test/kotlin/com/kgd/common/web/` 로 옮기고,
`HeadlessChrome` 케이스는 실측 문자열로 바꾼다 — `cdp-chrome.sh --headless=new` 가 보내는
`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`
(2026-09-20 실측). analytics 의 import 한 줄을 고친다. Spring 빈이 아닌 `object` 라 `scanBasePackages` 와 무관하다.

근거는 반복 횟수가 아니라 **지식의 DRY** 다 — 마커 목록은 운영 관찰로 자란다(meta-externalagent·reactornetty 둘 다
2026-09-17 ingress 실측). 두 서비스가 같은 목록을 따로 들면 한쪽만 갱신되어 「원장은 거르는데 랭킹은 받는」 상태가
된다. `game:feature → analytics:app` 의존은 불가라 복사 아니면 common 뿐이다.

### game — 사용 사례 (R1·R2·R3)

`SubmitGameScoreUseCase`:

```kotlin
data class Command(
    val slug: String, val track: ScoreTrack, val board: ScoreBoardKey,
    val nickname: String, val score: Long, val detail: String?,
    val memberId: Long? = null,
    /** 운영자(ROLE_ADMIN) 제출 — 기록하지 않는다. 맨 뒤 기본값 규칙은 memberId 와 같다 */
    val isOperator: Boolean = false,
    /** 자동화 UA 제출 — 기록하지 않는다 */
    val isAutomation: Boolean = false,
)
/** excluded 일 때만 rank = 0 */
data class Result(val applied: Boolean, val rank: Int, val excluded: Boolean = false)
fun execute(command: Command): Result
```

이름은 같은 BC 의 `ReplyToGameSuggestionUseCase.Command.isOperator` 와 맞춘다(같은 개념, 같은 식별자).

`GameScoreService.execute(Command)`: 닉네임·점수 검증 **뒤**, 저장소 호출 **앞**에서
`if (command.isOperator || command.isAutomation) return SubmitGameScoreUseCase.Result(false, 0, excluded = true)` —
검증은 그대로 받아야 시험 스크립트가 규격 밖 입력을 400 으로 보고, 로그에 닿는 닉이 규격 안 문자열이 된다.
제외 시 로그 한 줄(리터럴 고정, V5·V7 이 이 문자열을 grep 한다):

```kotlin
log.info { "score excluded slug=${command.slug} nick=$nick operator=${command.isOperator} automation=${command.isAutomation}" }
```

원시 UA·memberId 는 로그에 넣지 않는다. 중첩 `Result` 는 서비스 안에서 `SubmitGameScoreUseCase.Result(...)` 로
한정한다(맨 `Result` 는 `kotlin.Result`). 포트 `GameScoreRepositoryPort.submit` 은 `Pair` 그대로 두고 서비스가
`Result` 로 감싼다. 기존 테스트 단언 두 줄(`shouldBe (true to 1)`)은 `SubmitGameScoreUseCase.Result(true, 1)` 로 바꾼다.

`GameScoreController.submit`: `@RequestHeader(HttpHeaders.USER_AGENT, required = false)` 와
`@RequestHeader("X-User-Roles", required = false)` 를 받아 `isAutomation = CrawlerUserAgents.isCrawler(ua)`,
`isOperator = roles?.split(",")?.any { it.trim() == "ROLE_ADMIN" } == true` 로 Command 를 채운다(`GameSuggestionController`
의 `isOperator` 와 같은 식 — 두 번째 반복이라 복제, 이름은 같게). 위치 분해 대신 `Result` 필드명으로 받는다.
`ScoreSubmitResponse(applied, rank, excluded: Boolean = false)`.

게이트웨이 `game-score-submit` 라우트는 이미 `optionalUserConfig()` 를 걸어 `X-User-Id`·`X-User-Roles` 를
서버 발행값으로만 넣는다(손으로 붙인 헤더는 제거, 익명 통과 시 두 헤더 삭제) — 운영자 판별은 위조할 수 없고,
반대로 「나는 운영자다」라고 속여 기록을 **안 남기게** 하는 것은 이득이 없어 막지 않는다.

### portal-fe — 공용 위젯과 게임 22종 (R4)

`lib/rank.js` `postScore`:
- `headers` 에 `window.GameAuth && GameAuth.token()` 이 있으면 `Authorization: Bearer …`. 쿠키를 직접 읽지 않는다
  (토큰을 읽는 곳은 `auth.js` 하나).
- 응답 `d.excluded` 면 `note(L('excluded'))`. 문구: ko `운영·자동화 기록 — 랭킹에 오르지 않음`,
  en `Staff/automation run — not ranked`. 이 문구는 `autoPanel` 을 쓰는 게임(46종)에서 뜬다. `lib/platform.js`
  게임 28종은 지금도 제출 결과를 표시하지 않으므로 그대로다.

`lib/rank.js` 를 싣는 74종 중 **22종이 `lib/auth.js` 를 싣지 않는다** — 거기서는 로그인해도 Bearer 가 안 실려 운영자
판별이 없다. 22개 `index.html` 의 `<script src="../lib/rank.js">` 바로 앞에 `<script src="../lib/auth.js"></script>`
한 줄씩 넣는다. 부작용 점검: 22종 전부 `#codeInput`/`#codeShow` 가 없어 `menu.css` 의 `.game-signed-in` 숨김 규칙에
걸리는 요소가 없다(2026-09-20 확인).
목록: acid-rain alley-pool beat-dojo block-burst breeze-links cog-foundry crate-shift crimson-ravine drift-continent
element-pilgrim hand-alchemy mine-pioneer number-garden pixel-mine quad-weave rift-front rope-works royal-grid
sketch-sleuth spud-arena stone-sage word-warden.

**부수 효과(원래 설계의 복원)**: Bearer 가 실리는 순간 캔버스 게임의 로그인 제출이 처음으로 `member_id` 를 갖는다 —
게이트웨이 라우트 주석·V64 마이그레이션이 원래 의도한 것이고, `/me` 패널의 최고 기록이 아레나 밖에서도 채워진다.
운영자 자신의 `/me` 는 플레이 횟수만 늘고 최고 기록은 비어 있다(세션은 기록되고 점수만 안 남는다).

### amp-arena — 소스만 (범위 밖 게시)

`client/src/platform/score.ts`: `ScoreResult.excluded?: boolean`, `scoreNote` 가 `excluded` 면
`${label} 기록 ${score}점 · 운영·자동화 기록은 순위표에 오르지 않습니다`. 재게시는 하지 않는다 — **다음 게시까지
배포된 아레나는 제외 응답을 「연습 순위표 0위 · N점 (최고 기록 유지)」로 그린다**(옛 `scoreNote` 가 `rank=0` 을 그대로
찍는다). 운영자와 봇만 보는 화면이다.

`tools/e2e-prod-score.mjs` (R6):
- `.practice` 클릭 **전**에 `page.eval` 로 `window.fetch` 를 감싸 `/scores` POST 의 응답 JSON 을 `window.__scoreResp` 에
  둔다 — 게임의 실제 제출 경로를 그대로 지난다(스크립트가 따로 제출하면 검사가 만든 제출을 재게 된다). `cdp-page.mjs`
  에는 `Network` 도메인이 없다.
- 판정: `__scoreResp.data.excluded === true` · 보드 GET 이 `success === true` 이고 그 닉네임이 **없음** ·
  `noteRank` 는 「노트에 `${expectScore}점` 이 있다」로 바꾼다(옛 번들 `0위 …` 와 새 문구 둘 다 참).
- 헤더 주석을 「운영 DB 에 시험 기록이 한 줄 남는다」에서 「남지 않아야 통과」로 바꾸고, 결과에 번들 해시를 남긴다.

### 데이터 정리 (R7)

닉네임 패턴은 **찾는 데** 쓰고 **지우는 데** 쓰지 않는다 — 미리보기와 실행 사이에 무엇이 끼어들어도 지워지는 행은
내가 본 행뿐이어야 한다.

1. 읽기 — `oci-mysql game_db` (`SET NAMES utf8mb4;` 를 앞에 둔다. 한글 리터럴이 매치되는지는 **행 수로** 확인한다 —
   0 이면 charset 불일치이고 hex(`CONVERT(0x… USING utf8mb4)`)로 바꾼다):
   ```sql
   SELECT id, game_id, track, board, nickname, member_id, score, created_at FROM game_score
    WHERE nickname LIKE '실측%' OR nickname IN ('진행실측', 'zz-e2e-probe', '00');
   SELECT id, game_id, track, board, nickname, play_date FROM game_score_daily WHERE <같은 조건>;
   ```
   출력을 `verifications/purge.md` 에 그대로 붙이고, 닉·member_id·시각이 `requirements.md` 의 표와 맞는지 대조한다.
   `LIKE '실측%'` 에 실제 플레이어가 섞이지 않았는지 눈으로 본다.
2. 쓰기 — `oci-mysql --write game_db "DELETE FROM game_score WHERE id IN (<1 의 id>)"`, `game_score_daily` 도 같게.
   미리보기(ROLLBACK) 행 수가 목록 길이와 같을 때만 확인한다.
3. 순서 — V4 빨간불 실행(옛 서버)이 `실측` 행을 하나 더 만들고 V7 프로브가 `ROLE_USER` 행을 하나 만들 수 있으므로,
   정리는 **배포·V4·V7 뒤** 마지막에 한다. 예상 삭제 행은 17 + 그 추가분이다.

### 문서 (R8)

- ADR-0084 「2026-09-20 개정」 절: 신뢰 모델은 그대로이고, 이 규칙은 **조작 방어가 아니라 데이터 위생**이다 —
  운영자·자동화의 제출은 실제 플레이가 아니므로 기록이 아니다. `/api/v1/games/{slug}/scores` 에만 적용(아케이드 제외).
- `game/CLAUDE.md` `/scores` 행에 한 문장 + Key Rules 에 「운영자·자동화 제출은 기록되지 않는다 — 테스트는 로그인
  상태로, **상세 페이지를 연 지 1시간 안에**(토큰 만료 뒤 제출은 게스트다). e2e 는 UA 를 씌우지 않는다. 양성 경로
  (`applied=true`)를 운영에서 재야 하면 사람 UA + 사후 삭제, 또는 로컬 k3d」.
- `docs/architecture/common-features.md` 에 별도 행 「`CrawlerUserAgents` (`com.kgd.common.web`) — 일반 `object`,
  import 만, 스캔 무관」. `common/docs/service.md` Provided Components 표에
  `| web | CrawlerUserAgents | 자기소개형 크롤러·헤드리스 UA 판별 (ADR-0095) |`.
- 배포 순서 메모: `rank.js`(portal-fe 이미지)와 백엔드(code-dictionary 이미지)는 따로 배포된다. 백엔드가 먼저면 옛
  `rank.js` 가 「✅ 랭킹 등록 — 0위」를 띄우는 창이 있다 — 운영자·자동화만 보는 순간이라 조치 없음, V4 는 둘 다 Synced 뒤.
- game BC 사전이 없다(`docs/context-map.md` 에 `game` 행 없음). 이 스펙 뒤에 `/hns:glossary` 를 game 에 한 번 —
  시드: 운영자 제출 · 자동화 제출 · 제외(excluded) · 적용(applied) · 기록(record).

## 검증

| # | 근거 | 방법 |
|---|---|---|
| V1 | 단위 — `GameScoreServiceTest` | ① `isOperator=true` ② `isAutomation=true` → 각각 `Result(false, 0, true)` 이고 `scoreRepository.submit` **호출 없음**(`every` 를 선언하지 않는다 — MockK 는 스텁 없는 호출에 예외를 던진다 — 그리고 `verify(exactly = 0)`) ③ 둘 다 false → `Result(true, 1, excluded=false)`, `submit` 1회 ④ `isAutomation=true` + 닉 1자 → `BusinessException(INVALID_INPUT)` — 검증이 제외보다 앞선다 |
| V2 | 단위 — `CrawlerUserAgentsTest` (common 으로 이동) | 기존 케이스 전부 통과 + 실측 HeadlessChrome/153 UA |
| V3 | 조립 — `GameScoreControllerTest` (신규, `PrivateGameGateControllerTest` 방식: Spring 없이 생성자 조립, 실제 `GameScoreService` + 실제 `CrawlerUserAgents`, 포트만 mock) | ① 실측 헤드리스 UA · roles null → `submit` 0회, `excluded=true` ② 사람 UA · `ROLE_USER,ROLE_ADMIN` → 같음 ③ 사람 UA · `ROLE_USER` → `submit` 1회, `excluded=false` ④ 사람 UA · roles null(게이트웨이가 익명 통과 시 헤더를 지운다) → 기록됨. 판정은 **포트 호출 여부** |
| V4 | 컴파일·테스트 | `./gradlew :common:test --tests '*CrawlerUserAgentsTest' :game:feature:test --tests '*GameScoreServiceTest' --tests '*GameScoreControllerTest' :analytics:app:compileKotlin` |
| V5 | 운영 회귀 검사 (R1) | 배포 **전** 새 `e2e-prod-score.mjs` 를 옛 서버에 → 빨간불(`excluded` 필드 없음 · 닉이 보드에 있음). 배포 후(portal-fe·content 둘 다 Synced) 같은 스크립트 → 초록. 파드 로그 `score excluded … automation=true` |
| V6 | 데이터 | 정리 뒤 `SELECT COUNT(*)` (같은 패턴) = 0, 남은 행 = 정리 전 총행 − 삭제 행 |
| V7 | 운영 끝-끝 (R2·R4) — V5 는 UA 에서 먼저 걸려 운영자 배선을 못 잰다 | 전제: `member_roles` 에 운영자 계정의 `ROLE_ADMIN` 행 확인. 사용자가 `game.1989v.com` 에 로그인한 일반 브라우저로 `auth.js`+`rank.js` 게임 한 판(예 `archer-outbreak`) + 아레나 연습 한 판. 근거: ① 파드 로그 `score excluded … operator=true` ② 그 닉으로 `SELECT COUNT(*)` 변화 없음 ③ 위젯 문구(보조). 대조: `ROLE_USER` 토큰의 curl 제출은 `applied=true` 여야 한다(사람을 거르지 않는지) — 그 행은 정리 대상에 넣는다 |

## 열린 질문

없음 — 운영자 판별·정리 대상·판별기 위치·클라이언트 범위 넷은 2026-09-20 사용자 결정
(`context/key-decisions.md`). 리뷰 1회차 지적(22종 auth.js 추가·id 기반 삭제·조립 테스트·토큰 만료 문구)은
이 판에 반영했다.
