# Security Review — 게임 랭킹에 실제 플레이어 기록만 남긴다

- 판정: **REVISE** (필수 1건 — R7 정리 DELETE 를 미리 본 `id` 목록에 고정)
- 검토일: 2026-09-20
- 검토 범위: `spec.md` · `planning/requirements.md` · `context/key-decisions.md` + 스펙이 가리키는
  코드(게이트웨이 필터·라우트, 컨트롤러·서비스, `lib/rank.js`·`auth.js`, `score.ts`, 마이그레이션,
  `~/.local/bin/oci-mysql`)
- HNS_KB_PATH 미설정 — 볼트 조회 없음

## 요약

새로 생기는 신뢰 경계는 없다. 운영자 판별은 게이트웨이가 이미 위조 불가로 만든 헤더를 읽고,
자동화 판별은 기록을 **안 남기는** 방향으로만 작동하며, Bearer 를 싣는 위젯은 같은 iframe 에서
이미 같은 일을 하는 라이브러리 둘 옆에 서는 것이다. 스펙은 이 규칙을 「조작 방어가 아니라 데이터
위생」이라고 정확히 적었다. 남는 위험은 코드가 아니라 **운영 DB 를 손으로 지우는 절차** 하나다 —
닉네임 패턴으로 지우면 「지금 본 17행」과 「실행 시점에 걸리는 행」이 같다는 보장이 미리보기
행 수 하나뿐이다.

## 리드가 물은 다섯 초점

### (1) `X-User-Roles` 신뢰 — 확인됨

- 익명 통과 경로: `gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt:39`
  → `asAnonymous()` (`:87-90`) 가 `X-User-Id`·`X-User-Roles` 를 **제거**한다. 토큰 없음(`:45`)·
  블랙리스트(`:56`)·서명 무효(`:60`) 세 갈래 전부 이 경로다.
- 인증 경로: `:76-79` 가 `request.mutate().header("X-User-Roles", roles.joinToString(","))` 로 넣는다.
  `ServerHttpRequest.Builder.header()` 는 spring-web 7.0.9 에서 `HttpHeaders.put` — **덮어쓰기**다
  (javap 로 확인: `DefaultServerHttpRequestBuilder.header` → `HttpHeaders.put`). 클라이언트가
  같은 이름을 붙여 보내도 토큰의 역할로 대체된다.
- 라우트: `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:294-301`
  `game-score-submit` 가 `authFilter.apply(optionalUserConfig())` (`:45`, `required = false`) 를
  걸고, 필터 없는 `game-catalog` (`:353-357`, `/api/v1/games/**`) **보다 앞에** 선언돼 있다.
  `PathRoutePredicate` 는 trailing slash 를 기본 허용하므로 `/scores/` 도 같은 라우트다.
- 네트워크: `k8s/base/network-policy/00-default-deny.yaml` + `03-allow-gateway-to-backends.yaml` —
  content 파드 ingress 는 게이트웨이와 내부 배치(search-batch·place-ingest·ranking-ingest·blog)뿐이라
  게이트웨이를 건너뛰어 헤더를 직접 넣을 외부 경로가 없다.
- 컨트롤러 파싱 `roles?.split(",")?.any { it.trim() == "ROLE_ADMIN" }` 은
  `game/feature/src/main/kotlin/com/kgd/game/presentation/suggestion/controller/GameSuggestionController.kt:150-151`
  의 `isOperator()` 와 같은 관용구다. 역할 claim 이 비면 헤더가 `""` 로 오고 `[""]` 는 admin 이 아니다.

위조 방향 분석: 「나는 ROLE_ADMIN 이다」로 속여 얻는 것은 **자기 기록 삭제**뿐이고, 운영자가
기록을 남기고 싶으면 토큰을 빼고 게스트로 보내면 된다(R2 가 명시적으로 수용). 어느 쪽도
권한 상승이 아니다. 스펙 §game 의 서술과 일치한다.

### (2) `lib/rank.js` 의 `Authorization: Bearer` — 새 노출 없음

- 게임은 `portal-fe/src/pages/games/GameDetailPage.tsx:446`
  `sandbox="allow-scripts allow-same-origin allow-pointer-lock"` 안에서 돈다. `allow-same-origin` 이라
  iframe 의 origin 은 부모와 같고, `portal-fe/public/games/lib/auth.js:21-27` 이 이미 `document.cookie`
  에서 토큰을 읽는다 — **토큰은 이 변경 전부터 게임 스크립트에 보이는 값**이다(ADR-0079 설계).
- 같은 iframe 안에서 같은 토큰을 같은 `/api/v1/games/{slug}/…` 상대경로에 Bearer 로 싣는 코드가
  이미 둘 있다: `portal-fe/public/games/lib/meta.js:56`, `portal-fe/public/games/lib/platform.js:47`.
  아레나는 `amp-arena/client/src/platform/score.ts:32-36,47` 이 같은 쿠키를 읽어 같은 엔드포인트에
  싣는다. `rank.js` 는 세 번째 사본이 되는 것이지 새 수신처가 생기는 것이 아니다.
- `fetch('/api/v1/games/' + slug + '/scores')` (`rank.js:103`) 는 상대경로 → 같은 host → ingress →
  게이트웨이. 외부 origin 으로 나가는 경로가 없고, `rank.js:1-10` sitelock 이 `1989v.com` 밖에서는
  스크립트 자체를 멈춘다.
- CSRF 표면 변화 없음: 게이트웨이는 쿠키가 아니라 `Authorization` 헤더만 본다
  (`AuthenticationGatewayFilter.kt:35`). 다른 사이트에서 날린 POST 는 지금처럼 게스트 제출이다.

### (3) UA 판별은 옵트아웃 — 스펙이 방어라고 주장하지 않음

- `spec.md` §문서 R8: 「신뢰 모델은 그대로이고, 이 규칙은 **조작 방어가 아니라 데이터 위생**이다」.
- `docs/adr/ADR-0084-game-leaderboard-trust-model.md:29-32,52` 「막지 않는다 … 명백한 값만 거른다」와
  충돌하지 않는다. `CrawlerUserAgents.kt:13` 도 「스스로 밝히는 크롤러만 거른다」로 같은 전제다.
- 권고(비차단): ADR-0084 개정 절에 한 문장 — 「UA 를 바꾸거나 게스트로 놀면 통과한다. 그래도 된다」.
  「위생」이라는 낱말만으로는 다음 사람이 이 검사를 어뷰징 방어 항목으로 세지 않는다는 보장이 없다.

### (4) 제외 시 닉네임 `info` 로그 — PII 문제 없음, 단 원시 UA 는 계속 빼 둔다

- `docs/adr/ADR-0078-identity-minimization.md` 가 최소화하는 식별자는 이메일·실명·제공자 `sub` 다.
  `game_score.nickname` 은 사용자가 랭킹에 올리려고 고른 공개 별칭이고 이미 공개 API
  (`GET …/leaderboard`) 로 나간다. 로그에 적어도 새로 드러나는 것이 없다.
- 로그 주입: 스펙이 닉네임·점수 **검증 뒤**에 제외 분기를 두므로
  (`GameScoreService.kt:65` `NICK_REGEX = ^[\p{L}\p{N} _.-]{2,16}$`) 로그에 닿는 닉네임에는 개행·제어문자가
  없다. `slug` 도 `resolveGameId()` (`:138-141`) 를 통과한 카탈로그 값이다. 이 순서는 「400 을 받게
  한다」는 스펙의 이유 말고도 로그 안전성 때문에 유지할 가치가 있다 — 구현 시 순서를 바꾸지 않는다.
- 스펙은 `operator/automation` **불리언**을 적고 원시 `User-Agent` 는 적지 않는다. 그대로 둔다 —
  UA 는 공격자 통제 문자열이고 길이 제한도 없다. `memberId` 도 지금처럼 로그에서 뺀다
  (닉 + 회원번호가 한 줄에 있으면 별칭과 회원의 연결이 로그에 남는다).
- 레벨 `info` 는 `docs/conventions/logging.md` 규칙에 맞다(예외 없는 상황에 `error` 아님, 람다 형식).

### (5) 운영 DELETE 의 WHERE 범위 — **REVISE 대상**

조건 `nickname LIKE '실측%' OR nickname IN ('진행실측','zz-e2e-probe','00')` 의 문제:

1. **행을 세지 식별하지 않는다.** `~/.local/bin/oci-mysql --write` 는 `START TRANSACTION; <SQL>;
   SELECT ROW_COUNT(); ROLLBACK;` 로 **행 수만** 보여주고 확인을 받는다. 17 이라는 숫자는 「어느
   17행인가」를 말하지 않는다. `requirements.md` 의 표는 조사 시점의 근거이고, 실행 시점에 같은
   조건이 같은 행을 잡는다는 것은 별개의 사실이다 — 이번 하네스의 「증거는 내가 만든 것이
   아니어야 한다」가 정확히 이 틈을 가리킨다.
2. **`'00'` 은 실제 플레이어가 고를 수 있는 2글자 닉네임이다.** `NICK_REGEX` 최소 길이가 2 라
   허용되고, `\p{N}` 이 전각 숫자(`００`)도 통과시킨다. `game_score` 는 `DEFAULT CHARSET = utf8mb4`
   에 collation 미지정(`V15__game_score.sql:11`)이라 `_ci` 계열(서버 기본 `utf8mb4_unicode_ci`,
   `k8s/infra/local/mysql/statefulset.yaml:36`, 또는 charset 기본 `utf8mb4_0900_ai_ci`)인데, 두
   collation 모두 UCA 1차 강도라 전각 `００` 이 `'00'` 과 같게 비교된다. 지금 데이터에는 없겠지만
   조건문이 그것까지 포함한다는 사실은 적어 둘 만하다.
3. `LIKE '실측%'` 는 앞으로 누가 `실측왕` 같은 닉을 쓰면 잡는다. 이번 일회 실행에는 영향이 없지만
   이 SQL 이 문서에 남아 다음 정리에 복사될 때 같은 조건을 다시 쓰게 된다.

**요구 수정(스펙 §데이터 정리 R7):**

```text
1) 읽기:  SELECT id, game_id, nickname, member_id, created_at FROM game_score
          WHERE nickname LIKE '실측%' OR nickname IN ('진행실측','zz-e2e-probe','00');
          SELECT id, game_id, nickname, play_date FROM game_score_daily WHERE <같은 조건>;
   → 출력된 행 목록을 verifications/ 에 그대로 붙인다 (17행 + 일별 N행). 닉·member_id·시각이
     requirements.md 의 표와 맞는지 눈으로 대조한다.
2) 쓰기:  DELETE FROM game_score       WHERE id IN (<1)의 id 목록>);
          DELETE FROM game_score_daily WHERE id IN (<1)의 id 목록>);
   → oci-mysql 미리보기 행 수가 목록 길이와 같아야 확인한다.
3) V6 는 지금 그대로(패턴 COUNT = 0, 남은 행 19).
```

닉네임 패턴은 **찾는 데** 쓰고 **지우는 데** 쓰지 않는다. 그러면 미리보기와 실행 사이에 무엇이
끼어들어도 지워지는 행은 내가 본 행뿐이다.

## STRIDE

| 위협 | 새 진입점 | 판단 |
|---|---|---|
| Spoofing | `X-User-Roles` 위조 | 게이트웨이가 제거/덮어씀 (`AuthenticationGatewayFilter.kt:39,76-79,87-90`). 위조해도 얻는 것은 자기 기록 미저장뿐 |
| Tampering | 없음 | 응답 `excluded` 는 서버가 정하고 클라이언트는 표시만 |
| Repudiation | 제외 제출 | `log.info` 한 줄(slug·닉·사유)이 남는다 — V5 가 그 줄을 근거로 쓴다 |
| Info disclosure | `excluded=true` 응답 | 「판별됐다」는 사실만 노출. UA 검사는 방어가 아니므로(ADR-0084) 우회 힌트가 돼도 잃는 것 없음 |
| DoS | 없음 | 제외 분기가 저장소 호출 **앞**이라 자동화 트래픽의 DB 쓰기가 오히려 준다. 이 라우트에 rate limiter 가 없는 것은 기존 상태(ADR-0084 수용) |
| Elevation | 없음 | 헤더는 강등 방향으로만 작동 |

## 체크리스트

- [x] 위협 모델링 — 위 표
- [x] 인증/인가 경계 — 게이트웨이 필터가 유일한 발급자, NetworkPolicy 가 우회 차단
- [x] 민감 데이터 흐름 — 토큰: 이미 iframe 에 보이는 쿠키 → 같은 origin 헤더, 새 수신처 없음. 닉네임: 공개 별칭, 검증 뒤 로그
- [x] 입력 검증 바운더리 — 닉·점수 검증이 제외 분기보다 앞(스펙 명시). UA 는 부분 문자열 매칭만, 저장·로그 안 함
- [x] 서비스 간 통신 — 변화 없음 (`common` 의 `object` 이동은 빈·네트워크 무관)
- [x] 시크릿 — 없음
- [x] 암호화 — 변화 없음 (TLS 종단은 ingress)
- [x] 감사 로깅 — 제외 건 `info`, 기록 건은 DB 행이 곧 기록
- [ ] Rate limiting / Abuse — 이 스펙의 목적이 아니고 ADR-0084 가 안 막기로 결정. 해당 없음
- [ ] 결제/주문 — 해당 없음

## 비차단 권고

- ADR-0084 개정 절에 「우회 가능하며 그래도 된다」 한 문장 (초점 3).
- `isOperator(roles)` 관용구가 `GameSuggestionController.kt:150` 과 두 번째 반복이 된다. Rule of
  Three 전이라 지금 공용화는 요구하지 않되, 세 번째가 오면 `common.security` 로 올릴 자리다.
- 실제 플레이어 오탐: `CrawlerUserAgents.kt:39` 의 `(compatible; …)` 규칙과 `"bot/"`·`"spider"` 마커는
  사람 브라우저에서 사실상 안 걸리지만, 걸리면 그 사람의 기록이 조용히가 아니라 **문구와 함께**
  사라진다(R4 의 ko/en 안내). 지금 설계로 충분하다 — 다만 오탐 신고가 오면 마커가 아니라
  이 문구가 첫 단서라는 점을 `game/CLAUDE.md` 한 줄에 함께 적어 두면 좋다.
- `e2e-prod-score.mjs` 새 판정은 「응답 `excluded===true`」와 「보드에 닉 없음」을 **둘 다** 요구해야
  한다(스펙 R6 이 그렇게 적었다). 후자만 보면 제출이 통째로 실패해도 초록불이다 — 구현에서 둘을
  AND 로 묶는 것을 tasks 에 그대로 옮긴다.

## 스펙 밖 관찰 (기존 상태, 이번 변경과 무관 — 보고만)

- 게이트웨이의 신원 헤더 벗기기는 **라우트 단위**다. `/api/v1/games/**` 캐치올(`GatewayRouteConfig.kt:353`)
  은 필터가 없으므로, 게이트웨이의 경로 매칭과 업스트림 Tomcat 의 경로 정규화가 어긋나는 입력
  (예: `/api/v1/games/x/../y/me`)이 있다면 손으로 붙인 `X-User-Id` 가 그대로 통과할 수 있다.
  라우트 주석(`:280-283`, `:330-333`)이 지키려는 바로 그 사고다. **검증하지 않았고** 이 스펙의
  범위도 아니다 — 게이트웨이에 전역 정규화(또는 신원 헤더를 모든 라우트에서 먼저 벗기는 전역
  필터)를 두는 편이 라우트마다 필터를 기억하는 것보다 구조적으로 안전하다. 별도 이슈로.

## Round 2 (2026-09-20) — **SHIP**

1회차 REVISE 항목은 해소됐다.

- **R7 삭제 — 해소.** `spec.md:137-152` 패턴은 `SELECT id, …` 로 **찾는 데만** 쓰고, `DELETE … WHERE id IN (<읽은 id>)`
  로 지우며, 미리보기(ROLLBACK) 행 수가 목록 길이와 같을 때만 확인한다. 읽은 행 목록을 `verifications/purge.md` 에
  남기고 `requirements.md` 표와 대조하는 절차(`:147-148`)가 「지워지는 행 = 내가 본 행」을 보장한다. 정리를 배포·V5·V7
  **뒤** 마지막에 두어(`:151-152`) 검사가 만드는 추가 행도 같은 목록 절차를 탄다. `key-decisions.md:14` 가 패턴 삭제를
  문서에 남기지 않는 이유(`'00'` 은 실제 닉일 수 있음)까지 적었다.

새 항목 셋 — 새 위험 없음.

- **`auth.js` 22종 추가 (`spec.md:108-114`)**: `auth.js` 는 쿠키를 읽어 `GameAuth.token()` 과 `.game-signed-in` 클래스만
  만든다. iframe 이 `allow-same-origin` 이라 그 22개 페이지의 스크립트는 **이미** `document.cookie` 를 읽을 수 있었다 —
  노출 범위가 늘지 않는다. 로드 순서(`rank.js` 바로 앞)는 `auth.js:13-15` 의 요구와 맞고, 숨김 규칙 부작용은 스펙이
  22종 전부 확인했다(`:110-111`).
- **`rank.js` 의 Bearer (`spec.md:102-103`)**: 쿠키를 직접 읽지 않고 `GameAuth.token()` 만 쓴다 — 토큰을 읽는 곳이
  `auth.js` 하나로 유지된다(ADR-0079 사고의 재발 방지 조건). 만료 토큰은 게이트웨이 optional 필터가 익명으로
  통과시키므로(`AuthenticationGatewayFilter.kt:39`) 실패 모드는 「게스트로 기록」이지 오류·경고가 아니다 — 스펙이
  한계로 적었다(`:36-39`).
- **로그 한 줄 (`spec.md:82-85`)**: `slug`·`nick`·두 불리언만. `nick` 은 `NICK_REGEX` 통과값, `slug` 는 `resolveGameId()`
  를 통과한 카탈로그 값이라 제어문자가 없다. 원시 UA·`memberId` 제외를 명문화했다(`:85`). 리터럴 고정은 V5·V7 이
  이 문자열을 grep 하는 근거라 그대로 둔다.

비차단 메모 하나 — **V7 대조(`spec.md:179`)의 `ROLE_USER` 토큰**은 실제 회원 액세스 토큰이다. `verifications/` 나
셸 히스토리에 값을 남기지 않는다(`-H "Authorization: Bearer $TOKEN"` 처럼 환경변수로). 운영자 계정은 `ROLE_ADMIN`
이라 이 토큰은 **다른 계정**의 것이어야 하며, 그 행의 id 를 정리 목록에 넣는다는 절차는 이미 스펙에 있다.

판정: **SHIP** — 남은 보안 이슈 없음.
