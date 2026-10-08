# Engineer Review — usecase

- 대상: `docs/specs/2026-10-08-share-short-links/spec.md` (+ `planning/requirements.md`, `planning/initialization.md`, `planning/test-quality.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-share-short-links.md`)
- 차원: usecase (액터·흐름·전후조건·AC 추적·엣지 케이스·테스트 매핑)
- 일자: 2026-10-08
- KB 조회: 볼트 `1989v` 에서 단축 링크·base62·리다이렉트 개념 페이지는 없음. 클릭 원장 규율은 [[anonymous-identity-headers]] (vault, 2026-10 기준) §「조회수 — 원장이 진실, 카운터는 파생」(L159-170)을 표준으로 참조 — 「집계 실패가 본문을 막지 않는다」·「봇 UA 는 세지 않는다」 두 규칙은 스펙 SR-6 과 일치한다.

## 체크리스트 판정

| # | 항목 | 판정 | 요지 |
|---|---|---|---|
| 1 | Actor-goal 쌍 | 통과 | 운영자(이력서 복사·클릭 수)·방문자(공유)·수신자(열기) 네 스토리가 SR 로 이어진다 (spec.md:10-13) |
| 2 | Main/Alt/Exception 흐름 | **REVISE** | 관광지 공유의 주 흐름이 실제 상세 API 와 맞지 않음(U1), 게임 초대 링크 대체 흐름 파손(U2), 해석기 다운 시 예외 흐름 없음(U5) |
| 3 | 전제/사후 조건 | **REVISE** | 이력서 클릭 계측의 사후 조건이 기존 열람 원장과 겹치고 보존기간이 어긋남(U4), 배포 순서 전제 없음(U5) |
| 4 | AC 추적성 | **REVISE** | 크롤러 판정 기준이 정의되지 않아 AC 를 검사로 만들 수 없음(U3), SR↔테스트 행 매핑 부재(U6) |
| 5 | 엣지 케이스 | **REVISE** | 비정규 코드·디코드 값 범위·쿼리스트링·코드 없는 접두사(U3) |
| 6 | 테스트 전략 매핑 | **REVISE** | 순열 고정 골든 벡터 부재, 범위 기술 불일치, SR-3/5/6 테스트 누락(U6) |

## Findings

### U1. 관광지 상세 응답은 place 가 아니라 search 가 낸다 — `shortUrl` 을 실을 곳이 정해지지 않았다 (Check 2)

- 스펙: SR-5 「게임·글·관광지 상세 API 응답에 `shortUrl` 필드(절대 주소)를 더한다」 (spec.md:58), SR-2 「세 도메인과 상세 응답이 같은 것을 쓴다」 (spec.md:32). shaping 토폴로지에는 search 가 없다 (planning/shaping-state.yml:5).
- 코드: FE 관광지 상세는 `GET /api/search/attractions/{id}` 를 부른다 (`portal-fe/src/api/placeApi.ts:178-180`). 응답은 search `AttractionSearchController.findById` (`search/app/.../AttractionSearchController.kt:70-75`)가 OpenSearch 읽기 문서로 만든다. place 는 `/links` 만 낸다 (`placeApi.ts:216`).
- 영향: 「방문자가 관광지 상세에서 공유 버튼을 누른다」 주 흐름이 어느 응답에서 `shortUrl` 을 받는지 미정이다. 선택지에 따라 범위가 달라진다 — (a) search `:app` 응답 조립 시 common 코덱으로 계산(search 가 변경 대상에 추가), (b) 색인 문서에 필드 추가(인덱스 계약 게이트 `verifySearchIndexContract` 와 batch 재색인이 따라옴, `search/CLAUDE.md` 「인덱스 문서 계약」), (c) place `/links` 응답에 싣기.
- 수정안: SR-5 에 「관광지 `shortUrl` 은 search 상세 응답이 common 코덱으로 계산해 싣는다(색인 문서는 바꾸지 않는다)」처럼 한 곳을 명시하고, search 의 `id` 가 place 숫자 id 와 같은 값이라는 전제를 한 줄 적는다(SR-2 의 「대상의 숫자 id」와 디코더 왕복 테스트 test-quality.md:16 이 이 전제에 기댄다). 토폴로지에 search 를 더한다.

### U2. `copyGameLink` 를 `shortUrl` 로 바꾸면 온라인 대전 초대 링크(`?room=`)가 사라진다 (Check 2)

- 스펙: 「게임 상세의 기존 링크 복사(`copyGameLink`)도 `shortUrl` 을 쓴다」 (spec.md:62). 302 목적지는 `game.1989v.com/games/{slug}` 고정이고 쿼리 전달 규칙이 없다 (spec.md:22-23, 47).
- 코드/표준: `copyGameLink` 는 인앱 브라우저 안내의 「현재 링크 복사」이고 `window.location.href` 를 그대로 넘긴다 (`portal-fe/src/pages/games/GameBrowserHelp.tsx:7,12`). 기존 테스트가 「초대 URL 을 그대로 복사」를 고정한다 — `href='https://game.1989v.com/games/a?room=A#join'` (`portal-fe/src/pages/games/__tests__/browserHelp.test.ts:22`). 초대 링크 형식은 표준이 `…/games/<slug>?room=<CODE>` 로 정한다 (`docs/standards/online-versus-lobby.md:63-64`).
- 영향: 방 안에서 카카오 인앱 브라우저 사용자가 「현재 링크 복사」를 누르면 방 코드 없는 단축 주소가 복사되어 초대 진입로가 끊긴다. 이 함수는 공유 버튼이 아니라 「다른 브라우저로 같은 화면 열기」 도구다.
- 수정안: SR-5 의 `copyGameLink` 줄을 빼거나 「쿼리·해시가 없을 때만 `shortUrl`」로 좁힌다. 아울러 SR-4 에 「단축 주소의 쿼리스트링은 목적지에 붙이지 않는다/붙인다」 중 하나를 적는다(U3 참조).

### U3. 해석 입력의 엣지 케이스와 크롤러 판정 기준이 정의되지 않았다 (Check 4·5)

- 스펙: 디코더는 「허용 글자와 길이 범위」만 검사한다 (spec.md:33). 길이 범위의 상한은 적혀 있지 않다. 지원 범위는 0 ~ 2^40−1 (spec.md:34)이고 최소 6자다 (spec.md:28). 「크롤러 UA 는 기록하지 않는다」 (spec.md:69), 「`deal_offer_click` 과 같다」 (spec.md:67).
- 근거:
  - 62^6 ≈ 5.7×10^10 < 2^40 ≈ 1.1×10^12 < 62^7 ≈ 3.5×10^12. 그래서 코드는 6~7자이고, 형식상 유효한 7자 코드 상당수는 역순열 뒤 2^40 을 넘는다. 「값 범위 밖」을 형식 오류로 볼지 명시가 없다.
  - 6자 하한을 앞자리 채움으로 맞추면 `0abcdef` 와 `abcdef` 처럼 **같은 id 로 풀리는 다른 코드**가 생긴다. 해석은 되지만 SR-2 「같은 대상은 언제나 같은 코드」의 역방향(코드↔대상 1:1)이 깨지고, 클릭 원장에는 같은 대상이 여러 코드로 들어온다.
  - deal 은 봇을 **제외하지 않고** `ua_family='bot'` 으로 기록한다 — 「실데이터를 봐야 어디까지 걸러야 할지 안다」 (`deal/feature/.../DealRedirectService.kt:96-105`). 레포에 봇 판정이 세 벌 있다: deal `BOT_PATTERN` (같은 파일 :85), analytics `CrawlerUserAgents.isCrawler` (`analytics/app/.../CrawlerUserAgents.kt:15,41`), blog `BlogViewService.isBot` (`blog/feature/.../BlogViewService.kt:56`). 메신저 미리보기(카카오 스크랩 등)는 이력서 링크가 실제로 붙는 곳이라 기준에 따라 결과가 갈린다.
- 미정 엣지: 쿼리스트링(`/b/xxxxxx?utm_source=…`) 전달 여부, 코드 없는 접두사(`/g`, `/g/`), 뒤 슬래시·추가 세그먼트(`/g/xxxxxx/foo`), 대소문자가 바뀐 코드(base62 는 대소문자 구분 — 다른 대상으로 풀릴 수 있다).
- 수정안: SR-2 에 「길이 6~7자, 디코드 값이 0~2^40−1 밖이면 형식 오류, 다시 인코딩해 입력과 같지 않으면(비정규형) 형식 오류」를 넣는다. SR-6 에 크롤러 판정 함수를 하나로 지정한다(예: analytics `CrawlerUserAgents` 를 common 으로 올리거나 deal 정규식을 쓴다)와 「deal 과 달리 봇은 저장하지 않는다」를 의도로 적는다. SR-4 에 쿼리·코드 없는 접두사·추가 세그먼트 처리를 한 줄씩 적는다(예: 코드 없음 → `list`, 추가 세그먼트 → 형식 오류).

### U4. 이력서 클릭 원장의 사후 조건이 기존 열람 원장과 겹치고 보존기간이 ADR-0077 의 근거와 어긋난다 (Check 3)

- 스펙: 「도메인마다 클릭 원장 테이블 하나」·「대상별 누적 클릭 수」 (spec.md:67-68), 「네 원장을 90일 기준으로 정리」 (spec.md:70).
- 문서/코드: 이력서 제출처 링크에는 이미 링크별 방문 집계가 있고 어드민 목록이 보여 준다 — `visitCount`·`firstVisitedAt`·`lastVisitedAt` (`admin/frontend/src/pages/ResumePage.tsx:287-289`, `code-dictionary/feature/.../ResumeAdminService.kt:70`). 그 원장(`resume_access_log`)은 365일이고 이유가 「지원부터 결과까지 몇 달씩 걸리므로 90일이면 진행 중인 건의 기록이 사라진다」다 (`docs/adr/ADR-0077-ledger-retention.md:46`).
- 영향: `/r/{code}` 한 번에 단축 클릭 원장 1행 + 목적지 열람 원장 1행이 생긴다. 운영자 스토리(spec.md:13)의 「몇 번 들어왔는지」가 어느 숫자인지 정의가 없고, 같은 방문을 두 원장이 90일/365일로 다르게 지운다.
- 수정안: 둘 중 하나를 명시한다 — (a) 이력서 단축 클릭 원장도 365일로 두고 ADR-0077 표에 그 근거로 추가, 또는 (b) 이력서는 새 원장을 두지 않고 기존 열람 원장에 「단축 경유」 여부만 남긴다. 어느 쪽이든 「어드민 `visitCount` 는 무엇을 센다」를 사후 조건으로 한 줄 적는다.

### U5. 해석기 다운과 배포 순서에 대한 예외 흐름·전제가 없다 (Check 2·3)

- 스펙: 실패 시 목록으로 302 하는 이유는 「받은 사람이 빈 화면을 보지 않게」다 (ADR-0103-share-short-links.md:38, open-questions.yml:7). 운영 확인은 배포 후 실측뿐이다 (spec.md:77).
- 문서: 게이트웨이는 업스트림이 죽어도 **200 + 빈 바디**를 내린다 (`gateway/CLAUDE.md:28`). `/p` `/g` `/b` 는 content 한 파드로 간다 (spec.md:45, `GatewayRouteConfig.kt:26`).
- 영향: content 가 내려가면 세 종류 단축 주소가 전부 빈 흰 화면이 된다 — ADR 이 피하려던 바로 그 상태다. 또 `shortUrl` 을 내는 상세 API 가 게이트웨이·인그레스 경로보다 먼저 배포되면, 그 사이 공유된 주소는 apex `/` → portal-fe 로 떨어진다 (`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:84-86`).
- 수정안: SR-7 또는 Out of Scope 에 「해석 파드가 내려가면 빈 응답이 나간다 — 이번 범위에서 받아들인다」 또는 대응(예: portal-fe 가 `/r|p|g|b/*` 를 받으면 `list` 로 보내는 폴백)을 명시한다. 「`shortUrl` 노출(SR-5)은 해석 경로(SR-4) 배포·실측 뒤에 켠다」를 전제로 적는다.

### U6. 테스트 전략이 SR 과 이어지지 않고, 순열을 고정하는 검사가 없다 (Check 4·6)

- 순열 고정: ADR 은 「순열 상수를 바꾸면 이미 퍼진 단축 주소가 전부 깨진다. 순열 상수는 바꾸지 않는다」고 한다 (ADR-0103-share-short-links.md:50). 테스트는 왕복·충돌 없음뿐이다 (test-quality.md:7-8). 왕복 검사는 인코더·디코더가 같이 바뀌면 통과하므로 이 결정을 지키지 못한다. **고정 입력→고정 출력 골든 벡터**(예: id 1, 2, 2^40−1 의 기대 코드 문자열)를 넣어야 상수를 바꿨을 때 빨간불이 난다.
- 범위 불일치: test-quality.md:7 「Long 상한 근처」 ↔ spec.md:34 「0 ~ 2^40−1, 범위를 넘는 id 는 인코딩을 거부」. 2^40 거부 케이스가 테스트 표에 없다.
- 문구 오류: test-quality.md:11 「비공개·비공개 상태 게임」. 비밀 게임(ADR-0089)은 카탈로그 행 자체가 없어 코드가 생기지 않는다 (`game/CLAUDE.md:172`). 테스트 대상은 DRAFT·REVIEW·SUSPENDED 다 (`game/CLAUDE.md:197`). SR-4 「비공개 게임의 입장 게이트는 목적지 페이지가 처리한다」 (spec.md:50)도 같은 이유로 해당 사례가 없다.
- 누락 행:
  - SR-3 마이그레이션 뒤 코드가 빈 행 0 (spec.md:39), 어드민 목록 응답의 단축 주소 (spec.md:41).
  - SR-5 `shortUrl` 이 없을 때 현재 주소로 대체 (spec.md:61) — portal-fe 는 vitest 를 이미 쓴다 (`browserHelp.test.ts`).
  - SR-6 원장이 지워져도 누적 수 유지 (spec.md:68), retention CronJob 이 네 테이블을 지운다 (spec.md:70).
  - SR-7 로그 결과값에 「철회」가 빠져 있다 (spec.md:76 ↔ spec.md:52).
- 추적성: SR 에 AC 번호가 없고 테스트 행이 SR 을 가리키지 않는다. requirements.md:81 「응답 코드로 구분」은 스펙에서 전부 302 로 바뀌었는데(spec.md:52) 갱신되지 않았다.
- 수정안: test-quality.md 각 행 앞에 `SR-n` 을 달고, 위 누락 행과 골든 벡터 행(★)을 추가한다. 범위 행은 「2^40−1 인코딩 성공, 2^40 거부」로 바꾼다.

## 통과로 본 것

- 실패 시 목록 302 결정과 근거가 open-questions 에 닫혀 있고 deal 선례(`DealRedirectController.kt:43-45`)와 맞는다.
- 블로그 공개 판정 `PUBLISHED` 만은 도메인 규칙과 같다 (`blog/domain/.../BlogEnums.kt:47`). ARCHIVED 는 실패로 목록에 간다.
- 이력서 철회 → 해석 실패, 목록(= resume 홈)에서 공개 토글에 따라 게이트가 뜬다는 흐름이 명시돼 있다 (open-questions.yml:9, `ResumeAccessPolicy.kt:14-16`).
- 클릭 기록 실패가 302 를 막지 않는다 (spec.md:69) — 볼트 표준 [[anonymous-identity-headers]] 및 deal `recordQuietly` 와 일치.

## 요약

이슈 6건, 전부 스펙 수정으로 닫힌다. 사람 판단이 필요한 충돌은 없다. 우선순위는 U1(관광지 주 흐름) · U2(초대 링크 파손) · U6(순열 골든 벡터) 순이다.

VERDICT: REVISE

## Round 2

- 대상: 개정된 `spec.md`, `planning/test-quality.md`, `planning/requirements.md`, `context/review-verdict.md`(C1–C26 매핑)
- 일자: 2026-10-08

### 이전 발견 종결 확인

| 발견 | 판정 | 근거 |
|---|---|---|
| U1 관광지 `shortUrl` 위치 | 종결 | spec.md:69-70 「search:app 상세 응답 조립 시 계산, 색인 문서는 안 바꾼다, search 문서 id = place id 전제」. 전제는 코드로 확인 — 재색인이 `id = attraction.id.toString()` (`search/batch/.../AttractionApiReindexTasklet.kt:103`). 배포 게이트에 search 포함(spec.md:102) |
| U2 `copyGameLink` 초대 링크 | 종결 | spec.md:74 「바꾸지 않는다」 + test-quality.md:23 기존 `browserHelp.test.ts` 유지 |
| U3 디코더 경계·경로 엣지·크롤러 기준 | 종결 | 디코더 실패 4종 spec.md:35-36(길이 6~7, base62 밖, ≥2^40, 비정규형), 경로 처리 spec.md:60-61(쿼리 무시·코드 없는 접두사 = list·추가 세그먼트 = 실패), 크롤러 분류기 하나 + 실제 UA 표 + deal 과 다른 의도 명시 spec.md:79-80 |
| U4 이력서 원장 사후 조건·보존 | 종결 | spec.md:82-83 — 링크 id·시각만, 365일(ADR-0077), 「단축 주소 유입 수」와 기존 `visitCount`(「페이지 열람」)를 다른 숫자로 정의 |
| U5 해석기 다운·배포 순서 | 종결 | spec.md:103 노출 순서(SR-4 실측 뒤 SR-5), spec.md:104·129 빈 200 감수를 명시 |
| U6 테스트 추적·골든 벡터 | 종결 | 모든 행에 SR 태그(test-quality.md:5-33), 골든 벡터 ★ + 회귀 주입 확인(:7), 범위 행 2^40 거절(:10), SR-3/5/6 누락 행(:12·13·22·28), 비밀 게임 문장 정정 spec.md:57, 로그 결과값에 「폐기」 spec.md:94, requirements.md:81 「모두 302」로 갱신 |

공개 판정 함수 인용도 코드와 맞다 — `Game.isPlayable()`(`game/domain/.../Game.kt:153`), `PostStatus.publiclyVisible`(`blog/domain/.../BlogEnums.kt:47`), `ResumeShareLink.isUsable()`(`code-dictionary/domain/.../ResumeShareLink.kt:22`).

### 개정으로 새로 생긴 것

#### U7 (MINOR, 비차단). 레이트 리미터에 걸린 수신자의 예외 흐름이 정의되지 않았다 (Check 2)

- 스펙: SR-4 가 `/r` `/p` `/g` `/b` 에 `requestRateLimiter` 를 건다(spec.md:62-63). 실패 흐름은 「모두 list 로 302」(spec.md:58)인데, 리미터 거절은 도메인에 닿기 전에 게이트웨이가 429 로 끝낸다.
- 코드: 같은 설정의 리미터는 `RedisRateLimiter(100, 200, 1)`(`gateway/.../RateLimiterConfig.kt:42`), 키는 `X-User-Id` 없으면 `remoteAddress`(`RateLimiterConfig.kt:24-29`) — 인증 필터가 없는 경로라 IP 키다.
- 영향: 수신자가 429 를 받으면 「빈 화면을 보지 않게」 원칙(ADR-0103 §실패 처리)의 예외가 하나 더 생긴다. 한도가 초당 100이라 실제로 걸릴 가능성은 낮다.
- 수정안(선택): SR-8 「감수하는 한계」에 「리미터 초과 시 429 — list 로 보내지 않는다」 한 줄. 스펙을 다시 돌릴 사유는 아니다.

### 판정

이전 6건 모두 종결. 새 이슈는 MINOR 1건(U7, 문서 한 줄)뿐이라 구현 착수를 막지 않는다.

VERDICT: SHIP
