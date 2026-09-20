# Requirements — 게임 랭킹에 실제 플레이어 기록만 남긴다

## 문제

`game.1989v.com` 게임 상세 상단 랭킹과 허브 레일에 운영자 본인 플레이와 헤드리스 e2e 스크립트의
제출이 그대로 쌓인다. 2026-09-20 운영 `game_score` 36행 중 17행이 그것이다.

| 출처 | 닉네임 | 행 | 근거 |
|---|---|---|---|
| `amp-arena/tools/e2e-prod-score.mjs:10` | `실측NNNNNN` | 13 | `실측${Date.now().slice(-6)}` 를 만들어 운영 API 에 제출 |
| `amp-arena/tools/e2e-progress.mjs:55` | `진행실측` | 1 | 헤드리스 크롬으로 연습 판 |
| 초기 배포 점검 | `zz-e2e-probe` | 1 | deadline 2026-08-17 |
| 운영자 임시 닉 | `00` | 2 | 2026-08-23 15:02~15:04, `go` 와 같은 세션 |

서버(`GameScoreService`)는 닉네임 규격과 점수 상한만 본다(ADR-0084). 제출자가 사람인지,
운영자인지는 어디서도 보지 않는다. 게다가 공용 위젯 `lib/rank.js` 는 `Authorization` 을 싣지 않아
캔버스 게임 57종에서는 로그인 상태가 서버에 닿지 않는다 — 운영 데이터의 `go` 14행 중 13행이
`member_id NULL` 인 이유다(아레나만 Bearer 를 싣는다).

## 요구사항

- R1. **자동화 제출은 기록하지 않는다.** UA 가 `CrawlerUserAgents.isCrawler` 에 걸리면
  (`HeadlessChrome`·크롤러·빈 UA) 역대·오늘 보드 어디에도 쓰지 않는다.
- R2. **운영자 제출은 기록하지 않는다.** `X-User-Roles` 에 `ROLE_ADMIN` 이 있으면 R1 과 같다.
  게스트 상태의 운영자는 판별하지 않는다 — 사용자 결정(2026-09-20): 테스트는 로그인 상태로 한다.
- R3. 제외된 제출의 응답은 **성공(200)** 이고 `applied=false, rank=0, excluded=true` 다.
  분석 원장(ADR-0095)이 크롤러를 202/`accepted=0` 로 조용히 버리는 것과 같은 모양이다 —
  운영자 플레이마다 warn 로그가 남지 않게 BusinessException 을 던지지 않는다.
- R4. `lib/rank.js` 는 `GameAuth.token()` 이 있으면 Bearer 를 싣는다 — R2 가 캔버스 게임에서
  실제로 동작하기 위한 전제. `auth.js` 를 안 싣는 22종에는 그 한 줄을 넣는다(안 넣으면 그 게임들에서는
  로그인해도 운영자 판별이 없다). `excluded` 응답이면 등록 실패가 아니라 「랭킹에 오르지 않는 기록」이라고
  띄운다(ko/en, `autoPanel` 게임 46종).
- R5. 판별기는 `common` 으로 올려 analytics 와 공유한다 — 마커 목록이 운영 관찰로 자라는 **지식**이라
  두 서비스가 따로 들면 한쪽만 갱신된다. blog 의 `BOT_MARKERS` 는 뜻이 달라(curl·preview 포함, 조회수 용도) 그대로 둔다.
- R6. `e2e-prod-score.mjs` 의 판정을 뒤집는다 — 응답 `excluded=true` 이고 닉네임이 보드에 **없어야**
  통과. 이 스크립트가 게이트의 회귀 검사다.
- R7. 기존 행 정리 — `game_score`·`game_score_daily` 에서 위 표의 17행(+오늘 보드의 짝)을 지운다.
  패턴으로 찾고 **id 로 지운다**. `go`·`가즈아`·`스넥크` 는 남긴다(사용자 결정).
- R8. ADR-0084 에 개정 절을 더하고 `game/CLAUDE.md` 의 `/scores` 행에 규칙을 적는다.

## 범위 밖

- 아케이드 보드 `POST /api/v1/games/arcade/scores` — 세션 토큰 + 리플레이 검증이라 신뢰 모델이 다르다.
- 게임 안 토큰 재발급 — 상세 페이지를 연 지 1시간 뒤의 제출은 게스트로 기록된다. 문장으로 둔다.
- 아레나 클라이언트 재게시 — `score.ts` 소스만 고쳐 두고 다음 게시 때 반영(사용자 결정).
- 게스트 운영자 판별(브라우저 스위치) — 거절됨.
- `game_stats`·플레이 세션 정리 — 요청 없음.
- 어드민 기록 삭제 API — 요청 없음. 정리는 `oci-mysql --write` 일회.
