# Architecture review — round 1

Verdict: **REVISE**. 레이어 배치·의존 방향·트랜잭션 경계는 전부 맞다. 막는 것은 없고, 문서 규칙 한 줄 누락과
인바운드 포트 반환형 변경의 파급(기존 테스트 두 줄)이 스펙에 적혀 있지 않은 것이 고칠 거리다.
변경 크기(사용 사례 규칙 하나 · 헬퍼 이동 하나 · JS 위젯 한 줄)에 맞춰 짧게 본다.

## Seed discovery and evidence

- 읽은 것: `spec.md`, `planning/requirements.md`, `planning/test-quality.md`, `context/key-decisions.md`,
  `context/open-questions.yml`(빈 파일). 표준: root `CLAUDE.md`, `docs/conventions/package-structure.md`
  (ADR-0083), `docs/conventions/kotlin-style.md` §1·§1.1, `common/CLAUDE.md`, `game/CLAUDE.md`,
  `docs/architecture/common-features.md`, `docs/adr/ADR-0084-game-leaderboard-trust-model.md`.
- 코드: `GameScoreService.kt`, `SubmitGameScoreUseCase.kt`, `GameScoreController.kt`, `SavePorts.kt`,
  `GameScoreServiceTest.kt`, `analytics/.../CrawlerUserAgents.kt` + `EventCollectController.kt`,
  `GatewayRouteConfig.kt`(`game-score-submit`), `AuthenticationGatewayFilter.kt`, `lib/rank.js`, `lib/auth.js`,
  루트 `build.gradle.kts` `verifyLayerDependencies`, `amp-arena/client/src/platform/score.ts`,
  `amp-arena/tools/e2e-prod-score.mjs`.
- KB: `HNS_KB_PATH` 는 셸에 없고 `.claude/hns-hooks.env` 에만 있어 그 경로로 읽기 전용 검색.
  [[game-technique-catalog]] (1989v vault, updated 2026-08-31) §「랭킹 신뢰 모델 — 결정했다 (ADR-0084)」 —
  "상금도 순위 보상도 없는 기록 게시판이라 … 어뷰징 방어는 표 수 노출로 대체한다". 스펙의
  「조작 방어가 아니라 데이터 위생」(`spec.md:97-98`) 프레이밍과 충돌 없음.

## Findings

1. **Check: 문서 동기화 규칙(common) — 누락.** `common/CLAUDE.md` Key Rules 「새 컴포넌트 추가 시
   `docs/service.md` Provided Components 테이블 업데이트 필수」. 스펙 R8(`spec.md:95-101`)은
   `docs/architecture/common-features.md` 만 적고 `common/docs/service.md:18-41` 표를 빠뜨렸다.
   같은 자리에서 하나 더: `common-features.md:10` 「항상 로드」 행의 활성화 방식 칸이
   「`scanBasePackages`에 포함」인데, `CrawlerUserAgents` 는 빈이 아닌 `object` 라 스캔과 무관하다
   (`spec.md:34` 가 스스로 그렇게 적었다). 그 표에 같은 칸으로 넣으면 문서가 거짓이 된다 — 별도 행
   「정적 `object` — 활성화 불요」로 적는다.
   → R8 에 `common/docs/service.md` 행(`| web | CrawlerUserAgents | 자기소개형 크롤러 UA 판별 (ADR-0095) |`)을
   추가하고, `common-features.md` 행의 활성화 칸을 고친다.

2. **Check: 모듈 경계 변경 — 깨지는 호출자 미명시.** 인바운드 포트 `SubmitGameScoreUseCase.execute` 의
   반환형이 `Pair<Boolean, Int>`(`SubmitGameScoreUseCase.kt:9`) 에서 `Result` 로 바뀐다(`spec.md:50-51`).
   호출자는 `GameScoreController.kt:53`(`val (applied, rank) = …`) 과
   `GameScoreServiceTest.kt:307`, `:325`(`shouldBe (true to 1)`) 셋이다. 스펙 V1 은 「둘 다 false → 기존
   계약 그대로」(`spec.md:107`)라고만 적었는데, 그 두 단언은 `Result` 에 대해 **컴파일되지 않는다**
   (`Result shouldBe Pair` 는 타입 불일치). 구현자가 이걸 보고 `Pair` 를 지키려고 `Triple` 로 가면
   `GameScoreService.kt:61` 이 금지한 위치 분해로 되돌아간다.
   → 스펙 「변경 › game」에 「기존 단언 두 줄을 `Result(true, 1)` 로 바꾼다 — 계약은 이제 이름 있는
   data class 다」한 문장을 넣는다. `Result` 자체는 맞다 — `package-structure.md` 의 `usecase/`
   「UseCase interface + 내부 Command/Query/Result」와 일치한다.

3. **Check: 추상화 근거 문구.** R5·key-decisions 는 「세 번째 반복(analytics·blog·game)」
   (`requirements.md:32`, `key-decisions.md:9`)을 근거로 `common` 이동을 정당화하는데, blog 의
   `BOT_MARKERS`(`BlogViewService.kt:68-69`: curl·wget 포함, 조회수 용도)는 합치지 않는다고 같은
   줄에서 밝혔다. 그러면 공유 소비자는 둘(analytics·game)이고 `kotlin-style.md` §1 Rule of Three
   문구 그대로면 「두 번째까지는 중복을 그대로 둔다」에 걸린다. 이동 자체는 옳다 — 근거는 셈이 아니라
   **지식의 DRY** 다: 마커 목록이 운영 관찰로 자란다(`CrawlerUserAgents.kt:21` meta-externalagent,
   `:27-31` reactornetty — 둘 다 2026-09-17 ingress 실측). 두 곳이 같은 목록을 따로 들면 한쪽만
   갱신되어 「분석 원장은 거르는데 랭킹은 받는」상태가 된다. 그리고 `game:feature → analytics:app`
   의존은 애초에 불가(app 모듈·도메인 간 참조 금지)라 복사 아니면 common 뿐이다.
   Deletion test: `common` 에서 지우면 복잡도가 `EventCollectController.kt:45` 와 새 `GameScoreController`
   두 호출자로 흩어진다 → 값을 한다. `object` 라 어댑터 1개짜리 가설 seam 도 아니다.
   → 결정은 그대로 두고 근거 문장만 「같은 목록을 두 서비스가 함께 갱신해야 한다(지식 DRY)」로 바꾼다.

### Notes (non-blocking)

- **`isOperator` 두 번째 사본.** 스펙의 `roles?.split(",")?.any { it.trim() == "ROLE_ADMIN" } == true`
  (`spec.md:61`)는 `GameSuggestionController.kt:150-154` 의 `isOperator`/`ADMIN_ROLE` 과 글자까지
  같다. 같은 모듈 안 2회라 Rule of Three 로는 그대로 둬도 되지만, 스펙이 그 헬퍼를 **이름으로 가리켜**
  구현자가 세 번째 모양을 만들지 않게 한다. 뽑아낸다면 자리는 `presentation` 안이다 — 헤더 어휘를
  `application` 으로 올리지 않는다.
- **R2 의 실효 범위.** `rank.js` 가 `GameAuth` 를 통해서만 토큰을 읽는 것은 옳다(root `CLAUDE.md`
  「토큰을 읽는 곳을 늘리지 않는다」, `auth.js:21-27` 이 쿠키를 읽는 단일 지점). 다만 배포된 게임
  80종 중 **22종은 `rank.js` 만 싣고 `auth.js` 를 안 싣는다**(acid-rain·alley-pool·beat-dojo·block-burst·
  breeze-links·cog-foundry·crate-shift·crimson-ravine·drift-continent·element-pilgrim·hand-alchemy·
  mine-pioneer·number-garden·pixel-mine·quad-weave·rift-front·rope-works·royal-grid·sketch-sleuth·
  spud-arena·stone-sage·word-warden). 거기서는 운영자가 로그인해도 R2 가 무동작이다. 스펙은
  「지금처럼 게스트 제출」(`spec.md:72`)로 넘겼고 key-decisions 에 행이 없다. 숫자를 스펙에 적고,
  22곳에 `<script src="../lib/auth.js">` 한 줄을 넣을지(Minimal Diff 상 범위 확장이라 사용자 결정)
  명시적으로 결정한다. 아키텍처 판정에는 영향 없음.
- **옮기는 KDoc.** 「내용 그대로」(`spec.md:33`)면 `CrawlerUserAgents.kt:3-14` 의 ADR-0095 서사와
  `:27-30` 「이 서비스는 게이트웨이 뒤에 있고」가 공유 라이브러리에 그대로 실린다. 「이 서비스」가
  무엇인지 흐려지므로 첫 문단에 「게이트웨이 뒤 모든 서비스가 쓰는 자기소개형 크롤러 판별. 출처:
  ADR-0095」한 줄이면 족하다. 최소 수정 규칙상 verbatim 도 허용 — 선택.

## Passed

- **레이어 배치.** HTTP 어휘(`User-Agent`·`X-User-Roles`)는 `presentation` 에서 불리언으로 번역되고
  application 은 `operator`/`automation` 만 안다(`spec.md:59-61`) — 이미 `X-User-Id` → `memberId` 가
  같은 모양이다(`GameScoreController.kt:50,60`). 규칙은 application 서비스, 도메인 무변경, 아웃바운드
  포트 `GameScoreRepositoryPort.submit`(`SavePorts.kt:49-61`) 무변경, 인프라 무변경.
- **의존 방향.** `presentation → com.kgd.common.web` 은 게이트가 막는 패턴이 아니다 —
  `build.gradle.kts:308-315` 는 `*.infrastructure.`·`application.*.service.` import 만 본다.
  `common` 은 「레이어 규칙 비대상」(`package-structure.md` Infrastructure-only Modules).
  `game:feature`·`analytics:app` 둘 다 이미 `:common` 에 의존(`game/feature/build.gradle.kts:13`,
  `analytics/app/build.gradle.kts:10`) — 새 의존 없음. `web` 패키지 신설은 `webclient`(아웃바운드)의
  인바운드 짝으로 이름이 정직하다.
- **트랜잭션 경계.** 제외 조기 반환은 `@Transactional execute` 안, `resolveGameId`(SELECT 1회) 뒤 ·
  검증 뒤 · `submit` 앞. 소유권 그대로, 외부 IO 없음. 순서상 없는 slug 는 자동화도 404 를 받는다 —
  시험 스크립트가 사람과 같은 실패를 보는 것이 맞다.
- **신뢰 경계.** `game-score-submit` 은 `optionalUserConfig()`(`GatewayRouteConfig.kt:294-301`);
  필터는 익명 통과 시 클라이언트 신원 헤더를 제거하고(`AuthenticationGatewayFilter.kt:86-90`) JWT 에서만
  `X-User-Roles` 를 넣는다(`:77-78`). 만료·무효 Bearer 는 401 이 아니라 익명 통과(`:40-41`)라 R4 의
  Bearer 첨부가 제출을 깨뜨리지 않는다.
- **Seam.** 새 인터페이스·포트 없음. `CrawlerUserAgents` 는 `object`, 모의용 seam 아님.
- **모듈 간 파급.** analytics 는 import 한 줄(`EventCollectController.kt:3`) + 테스트 이동
  (`analytics/app/src/test/.../CrawlerUserAgentsTest.kt` → common). V3 가 `:analytics:app:compileKotlin`
  을 포함한다.
- **FE.** `score.ts:33,46-47` 은 이미 같은 쿠키를 Bearer 로 싣는다 — `rank.js` 변경은 캔버스 위젯을
  아레나와 같은 계약으로 맞추는 것이지 새 경로가 아니다.

## Required resolution

Finding 1(문서 행 두 개)·2(기존 단언 두 줄 명시)·3(근거 문구)을 스펙에 반영하면 SHIP. 사람 결정이
필요한 것은 Note 둘째(22종 `auth.js` 추가 여부)뿐이고, 그것은 이 스펙의 범위를 넓히는 일이라
아키텍처 판정과 무관하다.

## Round 2

Verdict: **SHIP**. 1회차 지적 셋 전부 반영됐고, 새로 들어온 내용에 아키텍처 이슈 없음.

| 1회차 | 상태 | 근거 |
|---|---|---|
| 1. `common/docs/service.md` 행 + `common-features.md` 활성화 칸 | 해결 | `spec.md:161-163` — 별도 행 「일반 `object`, import 만, 스캔 무관」 + service.md 행 `\| web \| CrawlerUserAgents \| … \|` |
| 2. `Result` 반환형 변경의 호출자 명시 | 해결 | `spec.md:85-87` 포트는 `Pair` 유지·서비스가 감쌈·기존 단언 두 줄 → `SubmitGameScoreUseCase.Result(true, 1)`; `spec.md:92` 컨트롤러는 위치 분해 대신 필드명. `kotlin.Result` 가림을 한정 이름으로 피한 것도 맞다 |
| 3. Rule-of-Three → 지식 DRY 근거 | 해결 | `spec.md:51-53`, `requirements.md:33-34`, `key-decisions.md:9` |
| Note · `isOperator` 사본 | 반영 | `spec.md:74,91-92` — `GameSuggestionController` 를 이름으로 가리키고 두 번째 반복임을 밝힘. 필드명은 `ReplyToGameSuggestionUseCase.kt:13` 의 `isOperator` 와 일치(확인) |
| Note · 22종 `auth.js` | 결정됨 | `spec.md:108-114`, `key-decisions.md:13` — 22종에 한 줄 추가, `.game-signed-in` 부작용 점검 포함. 토큰 읽는 곳은 여전히 `auth.js` 하나(`spec.md:102-103`) |
| Note · KDoc 「내용 그대로」 | 유지(선택 사항) | `spec.md:46` — 최소 수정 규칙상 허용 |

새로 추가된 항목 중 아키텍처와 닿는 것: V3 조립 테스트(`spec.md:175`)는 `PrivateGameGateControllerTest.kt:27`
방식(Spring 없이 생성자 조립, 포트만 mock)을 따르므로 새 seam 을 만들지 않는다. 아케이드 보드 범위 제외
(`spec.md:14-15`)는 별도 컨트롤러·신뢰 모델이라 경계가 맞다. 남은 이슈 없음.
