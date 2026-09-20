# Domain Review — 게임 랭킹에 실제 플레이어 기록만 남긴다

- 대상: `docs/specs/2026-09-20-leaderboard-real-players/spec.md`
- 차원: domain (유비쿼터스 언어 · 바운디드 컨텍스트 · 규칙의 위치)
- 날짜: 2026-09-20

## 판정: **REVISE** (비차단 · 설계 변경 없음 · 1라운드로 끝날 크기)

규칙의 위치와 컨텍스트 경계는 맞다. 고칠 것은 **이름 하나**(같은 개념에 두 식별자)와 **사전 부재**(game BC 가
context-map 에 없다)이고, 둘 다 스펙 한 줄과 사후 `/hns:glossary` 로 끝난다.

## Seed Discovery

| 단계 | 읽은 것 |
|---|---|
| 1 스펙 | `spec.md` — 참조: `GameScoreService`·`GameScoreController`·`SubmitGameScoreUseCase`·`lib/rank.js`·`CrawlerUserAgents`·ADR-0084·ADR-0095 |
| 2 동반 문서 | `planning/requirements.md`, `planning/test-quality.md`, `context/key-decisions.md`, `context/open-questions.yml`(열린 질문 0) |
| 3 표준 | `game/CLAUDE.md` Key Rules(183~), ADR-0084, ADR-0095, `docs/context-map.md`, `language-reference.md`. KB: [[anonymous-identity-headers]] (1989v, updated 2026-09-10), [[msa-game-platform]] (1989v raw, updated 2026-08-31) |
| 4 코드 | 참조 파일 전부 존재 확인. 현재 시그니처는 `Pair<Boolean, Int>` (`SubmitGameScoreUseCase.kt:9`) — 스펙이 `Result` 로 바꾸는 것을 명시하고 있으므로 불일치 아님 |

## 체크리스트

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 바운디드 컨텍스트 경계 · 누수 없음 | PASS | 판별기는 `common`(인프라, 도메인 어휘 없음 — `docs/context-map.md:44-48`)으로 올라가고 game·analytics 가 `object` 를 부를 뿐 Entity/Repository 교차 import 없음. analytics 쪽 변경은 import 한 줄(`EventCollectController.kt:45`) |
| 2 | 사전 존재 | **FAIL** | `docs/context-map.md:14-33` BC 표에 `game` 행이 없고 `game/glossary.md` 도 없다(스캔 시점 2026-05-11, game BC 는 그 뒤 생김). 이 스펙이 만든 공백은 아니지만 규칙상 REVISE → D2 |
| 3 | 스펙 어휘 ↔ 사전 | N/A→D2 | 사전이 없어 대조 불가. 새 용어 셋(운영자 제출·자동화 제출·제외)을 사전 시드로 넘긴다 |
| 4 | `Avoid:` 동의어 사용 | PASS | 대조할 사전이 없고, 인접 BC(analytics·auth·member) 사전에도 해당 용어 없음 |
| 5 | 유비쿼터스 언어 ↔ 코드 | **DRIFT 1건** | `Command.operator` vs 기존 `isOperator` → D1 |
| 6 | 애그리거트 불변식 | PASS(해당 없음) | play 컨텍스트에 점수 애그리거트가 없다(`game/domain/.../play/model/` 에 GameScore 없음). 「닉네임당 최고 1행」은 어댑터가 지키고(`SaveAdapters.kt:135-149`) 이 스펙은 건드리지 않는다 |
| 7 | 도메인 이벤트 범위 | PASS(해당 없음) | 이벤트 없음 |
| 8 | 교차 애그리거트 직접 참조 | PASS | 없음 |
| 9 | VO / Entity 분류 | PASS | `Result` 는 유스케이스 출력이지 도메인 VO 가 아니다. 두 불리언은 커맨드 플래그 — 선택 사항 D7 |

## 판정 근거 — 리드가 물은 세 가지

### (1) 규칙이 애플리케이션 계층에 있는 것이 맞나 — **맞다**

- 점수는 도메인 모델을 거치지 않고 포트로 바로 간다(`GameScoreService.kt:69-73` → `SavePorts.kt:49-62`).
  애그리거트가 없으니 「누구의 제출을 기록으로 치나」는 유스케이스가 갖는 정책이고, 이 스펙이 두는
  자리(닉·점수 검증 뒤, 저장소 호출 앞 — `spec.md:54-57`)가 그 정책의 자연스러운 위치다.
- 판별의 **재료**(UA 헤더, 게이트웨이가 넣은 `X-User-Roles`)는 HTTP 사실이라 컨트롤러가 불리언으로 번역하고
  (`spec.md:59-61`), 판정은 서비스가 한다. 같은 BC 의 개선 제안이 이미 이 모양이다 —
  `GameSuggestionController.kt:150-151` 이 `isOperator(roles)` 를 만들고 `ReplyToGameSuggestionUseCase.Command`
  (`:13`)로 넘겨 도메인이 결정한다(`GameSuggestion.kt:55-65`). 스펙은 그 관행을 따른다.
- ADR-0095 선례(`EventCollectController.kt:43-47`)는 컨트롤러에서 바로 버리지만, 여기서는 한 층 안으로 넣어
  HTTP 없이 단위 검증(V1, `verify(exactly = 0)`)이 되게 했다 — 더 나은 선택이다.
- ADR-0084 와의 관계도 맞게 읽었다. ADR-0084 는 「정말 그렇게 플레이했는가는 묻지 않는다」(조작 방어 포기)이고,
  이 규칙은 「이 제출은 플레이가 아니다」(데이터 위생)다. 스펙 R8 이 개정 절에 그렇게 적으라고 한다(`spec.md:97-98`).
  신뢰 모델 「기록 게시판」(ADR-0084 결과 절)은 그대로다.

### (2) 유비쿼터스 언어 — excluded / operator / automation

| 용어 | 코드에 있는 것 | 판정 |
|---|---|---|
| 운영자 (operator) | `ReplyAuthorType.OPERATOR`(`ReplyAuthorType.kt:12`), `GameSuggestion.OPERATOR_NAME = "운영자"`(`:90`), `Command.isOperator`(`ReplyToGameSuggestionUseCase.kt:13`), 판별 = `X-User-Roles` 의 `ROLE_ADMIN`(`GameSuggestionController.kt:150-154`) | **개념·판별 방식 일치.** 식별자만 `operator`(스펙) vs `isOperator`(코드) → D1 |
| 자동화 (automation) | 코드에는 「크롤러」뿐(`CrawlerUserAgents.isCrawler`, ADR-0095 「스스로 밝히는 크롤러만」) | 새 용어. game BC 에서 거르려는 것은 헤드리스 e2e(`e2e-prod-score.mjs:1-10`)라 「크롤러」보다 넓은 이름이 맞고, 판별기는 헤드리스 마커를 이미 갖는다(`CrawlerUserAgents.kt:25`). 스펙 규칙 표(`spec.md:17`)가 「자동화 = 판별기가 잡는 것 전부」로 정의하고 있어 충분 — 사전 시드로만 넘긴다 |
| 제외 (excluded) | 없음. 인접 어휘: `applied`(역대 최고를 넘었나 — `SaveAdapters.kt:136-153`), 아케이드 `accepted`/`reason`(리플레이 검증 — `ArcadeController.kt:62-68`), ADR-0095 `accepted=0` | 새 용어. 세 낱말이 세 뜻이라 충돌은 아니다. 다만 스펙이 `excluded` 를 **정의하는 문장이 없다** — 표(`spec.md:15-19`)에서 유추할 뿐 → D4(노트) |

### (3) 기존 사전과의 일관성 — 대조할 사전이 없다 → D2

## Findings

### D1 (REVISE) — 같은 개념, 두 식별자: `operator` vs `isOperator`

- 스펙: `val operator: Boolean = false`, `val automation: Boolean = false` (`spec.md:46-48`), 컨트롤러 `operator = roles?.split(",")…` (`spec.md:61`)
- 코드: 같은 BC · 같은 판별(ROLE_ADMIN) · 같은 층(유스케이스 커맨드)이 `isOperator` 다 —
  `ReplyToGameSuggestionUseCase.kt:13`, `GameSuggestion.kt:55`, `GameSuggestionController.kt:150`
- 드리프트 스캔 기준 「동일 개념에 다른 이름 없음」 위반. 검색으로 두 곳이 같은 개념임을 알 수 없게 된다.
- **수정**: 스펙의 필드명을 `isOperator` / `isAutomation` 으로. 컨트롤러 판별식은 `GameSuggestionController` 의
  `isOperator(roles)` 와 같은 식이 두 번째 반복이 되는데, Rule of Three 전이라 복제해도 되지만 **이름은 같게** 둔다.

### D2 (REVISE, 규칙상) — game BC 사전 부재

- `docs/context-map.md:14-33` 의 BC 표에 `game` 이 없고 `game/glossary.md` 가 없다. 체크리스트 규칙:
  「Missing glossary entirely → REVISE (recommend `/hns:glossary` after spec ships)」.
- 이 스펙이 만든 공백이 아니고 스펙을 막지 않는다. **수정**: 스펙 발송 뒤 `/hns:glossary` 를 game 에 한 번 돌린다.
  시드로 넘길 용어 — 운영자 제출(operator submission) · 자동화 제출(automation submission) · 제외(excluded) ·
  적용(applied, 자기 최고를 넘김) · 기록(record, 보드에 남는 행). `docs/context-map.md` 에 `game` 행 한 줄.

### D3 (노트) — 같은 BC 의 둘째 기록 경로(아케이드)가 범위 표에 없다

- `POST /api/v1/games/arcade/scores` (`ArcadeController.kt:50-70`) 는 세션 토큰 + 리플레이 검증이라 신뢰 모델이 다르고,
  스펙 Goal 은 `POST /api/v1/games/{slug}/scores` 만 가리킨다(`spec.md:9`).
- ADR-0084 개정 절에 「운영자·자동화의 제출은 실제 플레이가 아니므로 기록이 아니다」(`spec.md:97-98`)를 **BC 전체 규칙처럼**
  적으면 아케이드 보드가 말없이 예외가 된다. `requirements.md:40-45` 「범위 밖」에 한 줄(아케이드는 별도 검증 경로라 이번
  범위 밖)만 있으면 된다. 구현 변경 없음.

### D4 (노트) — `excluded` 정의 한 문장 · `rank=0` 의 뜻

- `excluded` 는 `applied=false`(자기 최고 미달, `rank` 는 현재 순위 ≥ 1 — `SaveAdapters.kt:151-153`)와 다른 축이다.
  스펙 규칙 절에 「`excluded` = 기록 대상이 아닌 제출. `applied` 와 독립」 한 문장을 두면 위젯·아레나·문서가 같은 뜻으로 쓴다.
- `rank=0` 은 지금까지 나온 적 없는 값(현재 항상 count+1 ≥ 1)이라 「순위 없음」 센티널이 새로 생긴다. `excluded` 가 있으니
  중복이지만 계약 모양을 안 바꾸는 선택으로 이해한다 — 응답 필드 주석에 「excluded 일 때만 0」 한 마디.

### D5 (OK) — 게이트웨이 신뢰 경계 주장 검증

- 「손으로 붙인 헤더는 제거」(`spec.md:64-66`)는 사실이다: `AuthenticationGatewayFilter.kt:77-78` 주입, `:86-89` 제거,
  라우트 `game-score-submit` 이 `optionalUserConfig()` 를 건다(`GatewayRouteConfig.kt:294-300`).
  KB [[anonymous-identity-headers]] (1989v, updated 2026-09-10) 「신뢰 경계는 헤더 이름이 아니라 누가 마지막에 썼나」와 일치.
- UA 부재가 게이트웨이 뒤에서는 `ReactorNetty` 로 바뀌는 것(`CrawlerUserAgents.kt:27-31`)도 game 경로에 그대로 적용된다 —
  `/scores` 가 같은 게이트웨이를 지난다. 스펙 표의 「빈 UA」(`spec.md:17`)는 실제로는 이 마커가 잡는다. 동작은 같다.

### D7 (선택 · 비차단) — 두 불리언 대신 한 개념

- `isOperator`·`isAutomation` 둘 다 「실제 플레이어가 아니다」 하나로 수렴하고, 둘을 가르는 곳은 로그 한 줄뿐이다(`spec.md:56-57`).
  `domain/play/model` 에 `SubmitterKind { PLAYER, OPERATOR, AUTOMATION }` 하나를 두면 스펙 제목의 개념(「실제 플레이어」)이
  코드에 이름으로 남고, 판정이 `!= PLAYER` 한 줄이 된다. 다만 둘 다 참인 경우(운영자가 헤드리스로 돌림)의 우선순위를 정해야 하고,
  최소 수정 원칙에 비추면 이번 크기에는 과하다. **안 해도 된다** — 하면 D1 이 자연히 해소된다.

## KB 인용

- [[anonymous-identity-headers]] (1989v, updated 2026-09-10) — `X-User-Id`/`X-User-Roles` 는 게이트웨이가 덮어써 위조 불가, 익명 통과 시 클라 헤더 제거. 스펙 D5 근거.
- [[msa-game-platform]] (1989v raw, updated 2026-08-31) `:645` — 「랭킹은 막지 않기로 결정했다(ADR-0084) — 못 막는다고 적어 두는 것이 결정이다」. 이 스펙이 그 결정을 뒤집지 않음을 확인하는 데 씀. 레포 문서와 모순 없음.

## 요약

- 규칙의 층(application) · 컨텍스트 경계(common 은 인프라) · 게이트웨이 신뢰 주장 — 전부 코드로 확인됨.
- 고칠 것: **D1** 필드명 `isOperator`/`isAutomation` (스펙 3줄), **D2** 발송 뒤 `/hns:glossary` game + context-map 한 줄.
- 적어 두면 좋은 것: D3 아케이드 범위 밖 한 줄, D4 `excluded` 정의 한 문장.

## Round 2 (2026-09-20) — 판정: **SHIP**

1회차 지적 넷을 개정본에서 대조했다. 처음부터 다시 보지 않았다.

| 지적 | 상태 | 근거 |
|---|---|---|
| D1 `operator` → `isOperator`/`isAutomation` | 해소 | `spec.md:65-67` 필드, `:74` 「같은 BC 의 `ReplyToGameSuggestionUseCase.Command.isOperator` 와 맞춘다」, `:90-92` 컨트롤러 배선, `:77`·`:82` 서비스, `key-decisions.md:15` |
| D2 game BC 사전 후속 | 해소(사후 작업으로 기록) | `spec.md:166-167` — `/hns:glossary` 를 game 에, 시드 다섯(운영자 제출·자동화 제출·제외·적용·기록) |
| D3 아케이드 범위 | 해소 | `spec.md:14-15` Goal, `:157` ADR 개정 절 「`/api/v1/games/{slug}/scores` 에만 적용(아케이드 제외)」, `requirements.md:43` 범위 밖 첫 줄 |
| D4 `excluded` 정의 · `rank=0` | 해소 | `spec.md:25-26` 「`excluded` = 기록 대상이 아닌 제출. `applied` 와 독립인 축」 + 「`excluded` 일 때만 `rank=0`」, `:69` `Result` 주석 |

새로 들어온 절 중 도메인 축에 닿는 것은 `spec.md:36-39`(운영자 판별의 한계 — 토큰 1시간 만료 뒤 제출은 게스트)와
`:116-118`(운영자의 `/me` 는 세션만 늘고 최고 기록은 빔) 둘인데, 둘 다 「세션은 기록, 점수만 제외」라는 이 스펙의 경계와
맞고 `requirements.md:44`·`:47` 범위 밖과 모순 없다.

남은 것(비차단, 문구 하나): `planning/test-quality.md:5` 가 아직 「`operator`/`automation` 각각」이라고 쓴다 —
`isOperator`/`isAutomation` 으로 맞추면 D1 이 문서 셋에서 같은 이름이 된다. 판정에 영향 없음.
