# Engineer Review — usecase

- 대상: `docs/specs/2026-09-23-ad-network/spec.md` (+ `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `context/concepts.md` · ADR-0098)
- 차원: usecase (행위자-목표 · 주/대안/예외 흐름 · 사전/사후 조건 · AC 추적성 · 엣지 케이스 · 테스트 매핑)
- 리뷰일: 2026-09-23
- KB: [[anonymous-identity-headers]] (concept, updated 2026-09-20) — 표준으로 적용

## 체크리스트 판정

| # | 항목 | 판정 | 요약 |
|---|---|---|---|
| 1 | 행위자-목표 쌍 | 통과 | 광고주·방문자·운영자 5개 스토리 (spec.md:11-15). 퍼블리셔는 운영자가 겸함 |
| 2 | 주/대안/예외 흐름 | **REVISE** | 본인 제외 흐름이 실제 경로에서 성립하지 않음(R1). 결정 API 장애 시 채움 순서 누락(R3). HOUSE 이관 흐름 불일치(R2) |
| 3 | 사전/사후 조건 | **REVISE** | 캠페인 생명주기 전이·정지 광고주 읽기 권한 미정(R5). 카테고리 키 원천 없음(R4) |
| 4 | AC 추적성 | **REVISE** | SR↔AC↔테스트 대응표 없음(R7) |
| 5 | 엣지 케이스 | **REVISE** | 빈도 카운터 증가 시점, 방문자 ID 범위, 클릭 토큰 발급(R6) |
| 6 | 테스트 전략 매핑 | **REVISE** | 본인 제외 테스트가 거짓 초록을 낼 구조, FE 채움 순서 단위 테스트 없음(R7) |

광고주 콘솔 로그인 흐름은 확인 결과 **문제 없음**. 서브도메인 `/login` 은 apex 로 넘어가고(`portal-fe/src/App.tsx:153-157`, `:229-232`, 판정 `isProd1989vHost` 가 `*.1989v.com` 전체를 덮음), 돌아올 주소 `next` 는 `safeNext` 가 `*.1989v.com` 을 통과시킨다(`portal-fe/src/auth/auth.ts:125-138`). 토큰은 `.1989v.com` 도메인 쿠키이고 axios 인터셉터가 Bearer 로 싣는다(`portal-fe/src/shell/apiClient.ts:20`). `ads.1989v.com` 을 넣어도 ADR-0079 의 OAuth redirect_uri 는 늘어나지 않는다.

## 이슈

### R1 — 광고주 본인 제외가 이벤트·클릭 경로에서 성립하지 않는다 (체크 2 · 5)

- 스펙: SR-8 「광고주 본인(로그인 회원 = 캠페인 소유자)의 노출·클릭은 과금하지 않는다」 (spec.md:75). SR-7 은 이벤트를 `sendBeacon` 으로 받도록 허용하고 (spec.md:68), 클릭은 `GET /api/v1/ads/click/{clickToken}` 페이지 이동이다 (spec.md:69)
- 코드: 게이트웨이는 신원을 **`Authorization: Bearer` 헤더에서만** 읽는다 (`gateway/.../security/JwtTokenValidator.kt:13-17`, `AuthenticationGatewayFilter.kt:35-36`). 비콘은 헤더를 실을 수 없다 — 레포에 이미 적혀 있다: 「beacon 은 헤더를 못 실어」 (`portal-fe/src/analytics/tracker.ts:64`). 클릭 이동도 브라우저 내비게이션이라 Bearer 헤더가 없다. 쿠키를 직접 읽는 곳은 비공개 게임 관문 하나뿐이다 (game/CLAUDE.md 「이 엔드포인트만 쿠키를 직접 읽는다」)
- 결과: 이벤트·클릭 핸들러에는 로그인 회원이 늘 익명으로 도착한다. `self` 거절 사유(spec.md:77)는 영원히 0 이 된다
- 수정안: 본인 판정을 **결정 시점**으로 옮긴다. 결정 호출은 axios 라 Bearer 가 실리므로 `X-User-Id` 가 있다. (a) 요청자 소유 캠페인을 후보에서 빼거나, (b) 노출·클릭 토큰 서명 필드에 `selfServe=true` 를 넣어 이벤트에서 거절한다. SR-7 토큰 필드 목록(spec.md:66)에 이 필드를 추가한다
- 같이 고칠 것: SR-13 의 「공개(결정·이벤트·클릭·에셋)」 (spec.md:104) 를 **「게스트 허용 — `optionalUserConfig` 필터 적용」** 으로 바꿔 적는다. 필터 없는 공개 라우트는 클라이언트가 붙인 `X-User-Id` 를 그대로 통과시킨다. 이 레포에서 두 번 사고가 났다 ([[anonymous-identity-headers]] 「게스트 허용 경로에도 헤더 제거 목적으로 필터를 건다」). 현행 `game-ads` 라우트가 바로 그 모양이다 (`GatewayRouteConfig.kt:369-376`)

### R2 — HOUSE 이관이 기존 동작과 모양이 안 맞아 AC-16 「전과 같이」를 못 지킨다 (체크 2)

- 소재 모양: 기존 HOUSE 소재는 `title·body·href·emoji` 이고 이미지가 없다. href 는 앱 내부 상대 경로다(`'/'`, `'/shop'`, `'/portfolio'`) (`game/.../gamedb/migration/V6__ads_house.sql:45-49`, `portal-fe/src/api/gameApi.ts:512-517`). 화면은 SPA `<Link>` 로 이동한다 (`HouseBanner.tsx:30`). SR-3 의 Creative 는 **이미지 1장 필수 · 랜딩 `https` 만**이다 (spec.md:36-37). 시드 마이그레이션(spec.md:105)을 그대로 쓰면 검증을 통과하지 못한다
- 순환: SR-6 은 「기존 순환 동작을 유지」한다고 한다 (spec.md:61). 순환에는 소재 N개가 필요하다 (`HouseBanner.tsx:19-24`, 6초 간격). 그런데 결정 응답은 지면마다 「HOUSE 대체 소재(있으면)」 하나만 준다 (spec.md:54)
- 빈도: 기존 HOUSE 는 `BANNER` 최소 간격 60초로 판정한다 (`V6__ads_house.sql:37-38`, `AdService.kt:56-59`). 새 캠페인 기본값은 방문자당 하루 3회다 (spec.md:35). 이 값을 그대로 쓰면 하루 세 번째 방문 뒤로 배너가 사라진다
- 수정안: SR-3 에 HOUSE 전용 소재 형식을 적는다(이미지 없음 허용 · 내부 경로 랜딩 허용 · 클릭은 리다이렉터를 거치는지 여부). SR-5 에 「HOUSE 는 지면당 소재 목록을 준다」를 적는다. HOUSE 캠페인의 빈도 규칙(없음 또는 60초 간격)을 SR-12 에 명시한다. 한 가지 더: 시드에는 FE 호출처가 없는 `game-detail-banner` 가 있다 (`V6__ads_house.sql:50-51`, FE 사용처는 `GamesPage.tsx:249` 의 `game-list-banner` 하나뿐). 이것을 이관할지 버릴지 SR-13 에 적는다

### R3 — 결정 API 실패 시 채움 순서가 정해져 있지 않다 (체크 2)

- 지금은 AdSense 가 결정 API 와 무관하게 뜬다 (`AdSlot.tsx:45-51`). SR-6 뒤로는 AdSense 가 「자체 결정을 먼저 받고」 난 다음에 뜬다 (spec.md:58). 게이트웨이는 업스트림이 죽어도 **200 + 빈 바디**를 낸다 (gateway/CLAUDE.md). 이것을 처리하지 않으면 engagement 장애가 곧 blog·game 의 AdSense 수익 0 이 된다. OQ-003 이 경고한 대로 시크릿이 빠지면 engagement 파드 전체가 못 뜨므로 이 경로는 실제로 일어난다
- AC-7 은 Redis 장애만 다룬다 (requirements.md:85)
- AdSense 가 채우지 못한 경우(unfilled)도 빠져 있다. 지면 ID 가 있으면 HOUSE 로 내려가지 않으므로 「광고」 라벨만 붙은 빈 상자가 남는다
- 수정안: SR-6 에 예외 흐름 세 가지를 적는다. ① 결정 호출 실패·타임아웃(예: 800ms)·빈 바디이면 AdSense(ID 가 있을 때) 아니면 숨김 ② AdSense unfilled(`data-ad-status="unfilled"`)이면 응답에 HOUSE 가 있을 때 HOUSE 로 바꿔 그림 ③ 결정을 기다리는 동안 `minHeight` 자리를 예약할지, 숨김으로 끝날 때 레이아웃 이동을 허용할지. 이에 맞춰 AC-6·AC-7 을 넓힌다

### R4 — 문맥 카테고리 키와 지면 카탈로그의 원천이 없다 (체크 3)

- SR-3 은 캠페인에 「타기팅 문맥 카테고리 집합」을 두고 (spec.md:35), SR-5 는 결정 입력으로 「문맥 카테고리 키」를 받는다 (spec.md:48). 그런데 키 목록과 페이지별 매핑(블로그 카테고리 · 게임 장르 · 관광지 분류 · 혜택 카테고리)이 어디에도 없다. concepts.md E5 는 「자체 분류로 시작」이라고만 한다. 이 상태로는 광고주가 고를 목록도 없고 FE 가 보낼 값도 없다
- 광고주가 지면을 고르려면 지면 목록·형식·최저가를 읽는 API 와 화면이 필요하다 (concepts.md C10 ●). 그런데 콘솔 화면 목록(spec.md:63)과 API 에 광고주용 지면 조회가 없다. 지면 API 는 어드민용(spec.md:99)뿐이다
- 수정안: SR-4 에 카테고리 키 등록부(키 · 표시명 · 어느 호스트의 무엇에서 나오는지)와 FE 매핑 표를 둔다. SR-6 콘솔 화면에 「지면 카탈로그(형식·최저가·허용 비율)」를 넣고, 광고주용 `GET /api/v1/ads/placements` 를 명시한다
- 덧붙임: `attractionEnd`·`dealHubEnd` 는 AdSense 게시자 정책 때문에 **일부러 비워 둔** 지면이다 (`portal-fe/src/seo/copy.mjs:1097-1110`). 자체 광고는 그 정책을 받지 않는다는 판단과, 혜택 허브에서 제휴 고지 카드 옆에 「광고」 카드를 두는 배치 규칙을 SR-4 에 한 줄 적는다

### R5 — 캠페인·소재·광고주 상태 전이의 사전/사후 조건이 비어 있다 (체크 3)

- SR-3 은 상태 이름만 나열한다 (spec.md:35). 다음이 정해져 있지 않다
  - `DRAFT → ACTIVE` 를 누가 언제 하는가. 승인된 소재가 최소 1개 있어야 하는가
  - `endAt` 경과나 총예산 소진 때 자동으로 `ENDED` 가 되는가
  - 지갑 잔액이 0 일 때(spec.md:90) 상태는 그대로이고 후보에서만 빠지는가. 콘솔이 그 이유를 보여 주는가
- 이미 `APPROVED` 인 소재를 고치면 `PENDING` 이 된다 (spec.md:36). 재심사 동안 옛 승인본을 계속 내보내는지, 게재를 멈추는지를 적어야 한다
- `SUSPENDED` 광고주는 쓰기만 막힌다 (spec.md:29). 리포트·잔액 조회는 되는지, 정지 사유가 보이는지가 없다
- 수정안: SR-3 에 상태 전이 표(이벤트 · 가드 · 행위자 · 후보 인덱스 영향)를 추가한다. test-quality U7 의 기대값을 그 표에서 끌어온다

### R6 — 빈도 카운터 증가 시점 · 방문자 ID 범위 · 클릭 토큰 발급 (체크 5)

- 빈도: SR-5 는 「방문자 빈도 제한 미달」을 자격 조건으로 쓴다 (spec.md:49). 그런데 SR-7 에서 이벤트가 올리는 카운터는 캠페인 일 지출과 소재×지면 시간 카운터뿐이다 (spec.md:70). 방문자 빈도 카운터를 결정할 때 올리는지, 가시 노출이 받아들여질 때 올리는지가 없다
- 방문자 ID: `X-Visitor-Id` 는 게이트웨이가 `vid` 쿠키 값으로 **덮어쓴다**. 이 쿠키는 httpOnly 이고 host-only 다 (`gateway/.../filter/VisitorIdFilter.kt:24-39`, [[anonymous-identity-headers]]). 그래서 빈도 제한과 클릭 속도 제한(spec.md:76)은 서브도메인마다 따로 센다. FE 의 `kgd.visitorId`(`portal-fe/src/analytics/identity.ts:8`)와 값이 다르다. 이것이 의도라면 SR-5 에 「빈도는 호스트별」이라고 적는다
- 클릭 토큰: SR-7 은 `clickToken` 을 쓰지만 (spec.md:69), SR-5 의 응답에는 「서명된 노출 토큰」만 있다 (spec.md:54). 클릭 토큰을 어디서 발급하는지, 가시 노출이 기록되기 전의 클릭도 CPC 로 과금하는지 적는다
- 토큰 수명: 30분 (spec.md:66). 긴 글 끝 지면(`blogPostEnd`)은 결정 뒤 30분이 지나서 보일 수 있다. 결정을 지면이 가까워질 때 부를지(concepts.md D16 ●) 정하거나, 만료로 거절되는 비율을 받아들인다고 적는다
- 인용 정정: 50%·1초 감지 규칙은 `tracker.ts` 가 아니라 `portal-fe/src/analytics/useImpression.ts:13-15` 에 있다 (spec.md:67)

### R7 — AC 추적성과 테스트 매핑 (체크 4 · 6)

- SR-1~16 과 AC-1~17 과 테스트 ID(U/I/C/E)를 잇는 표가 없다. 그래서 다음이 빠진다
  - AC 는 있는데 테스트가 없는 것: AC-1(전역 Role 불변) · AC-3(잔액보다 큰 일예산도 저장) · AC-13(리포트 = 정산 표) · AC-14 의 정지 절반(I6 는 승인만 봄) · AC-15 의 어드민 목록 · AC-16 의 코드·표 제거
  - SR 은 있는데 AC 가 없는 것: 같은 캠페인의 두 지면 동시 낙찰 금지 (spec.md:53) · 페이싱 (spec.md:52) · 에셋 불변 캐시 헤더 (spec.md:37) · 콘솔 `noindex`·「가상 크레딧」 표기 (spec.md:31, :62) · 매일 원장 합 검사 (spec.md:84) · `/privacy` 상수 일치 (spec.md:121)
  - 충전 하루 한도에서 동시 요청 두 건이 경계를 함께 넘는 경우: I5 는 순차 경계만 본다
- 거짓 초록 위험: I7(본인 클릭)을 `:ads:feature` 통합 테스트로 짜서 `X-User-Id` 를 직접 넣으면 통과한다. 하지만 실제 경로(비콘·내비게이션 → 게이트웨이)에서는 R1 때문에 신원이 도착하지 않는다. 검사가 대상이 아니라 자기가 만든 헤더를 재는 모양이다. E1 에 「로그인한 광고주가 자기 광고를 본다 → `self` 카운트 증가, 과금 0」을 넣고, 게이트웨이를 통과하는 경로로 확인한다
- FE: 채움 순서(유료 → AdSense → HOUSE → 숨김)와 R3 의 실패 흐름은 portal-fe 단위 테스트(vitest, 기존 `__tests__` 방식)로 고정할 수 있다. 지금은 E2 CDP 검증 하나뿐이다
- 수정안: `planning/test-quality.md` 앞에 「AC ↔ 테스트」 표를 두고, 비어 있는 칸을 위 목록으로 채운다

### R8 (경미) — `ads.1989v.com` 을 여는 사전 조건

- 새 서브도메인 체크리스트 네 곳(spec.md:62) 말고도 필요한 것이 둘 있다. ingress TLS `hosts` 목록에 호스트를 추가해야 한다 (`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:54-66`). Cloudflare DNS 는 proxied 레코드여야 한다(루트 CLAUDE.md, ADR-0061). DNS 는 사람이 대시보드에서 하는 작업이므로 태스크의 사전 조건으로 적는다
- 콘솔에 들어오는 세 경우의 첫 화면을 적는다: 비로그인(→ `buildLoginHref`, `auth.ts:146-151`) · 로그인했지만 광고주 아님(→ 등록) · `SUSPENDED`(→ R5)

## 요약

이슈 8건(차단 없음, 수정 필요 7 · 경미 1). 스펙을 고치면 해결되며, 사람이 판단해야 할 것은 없다. 가장 무거운 것은 R1 이다. 본인 제외 규칙은 지금 설계대로면 운영에서 한 번도 동작하지 않고, 테스트는 초록으로 남는다.

VERDICT: REVISE

---

# Round 2 — 개정 2 재리뷰 (2026-09-23)

- 대상: spec.md 개정 2 · requirements.md · test-quality.md 개정 2 · open-questions.yml · ADR-0098
- 확인한 코드: `GatewayRouteConfig.kt:45,370-377` · `AuthenticationGatewayFilter.kt:33-47,87-90` · `VisitorIdFilter.kt:23-44` · `apiClient.ts:17-35` · `tracker.ts:63-64` · `AdSlot.tsx:39-77` · `HouseBanner.tsx:9-41` · `gameApi.ts:539-541` · `GamesPage.tsx:249,367` · `DealPage.tsx:226` · `copy.mjs:1091-1111` · game `AdController.kt:35-60` · `AdService.kt:50-68`
- 인용한 라인 번호(spec.md:NN)는 개정 2 기준이다. Round 1 의 라인 번호는 개정 1 기준이다

## Round 1 항목 해소 확인

| # | 판정 | 근거 (개정 2) |
|---|---|---|
| R1 본인 판정 | **해소** | 결정 시점 판정 + 토큰 `과금 여부` 서명 (spec.md:74, :80-84). 게스트 필터 라우트 (spec.md:83, :130). 게이트웨이를 거친 테스트 C3·C4 (test-quality.md:63-64), 회귀 주입 C4 (:121). 인용 `tracker.ts:63` 이 sendBeacon 줄과 맞다. 필터는 토큰이 틀려도 401 을 내지 않고 익명으로 통과시킨다 (`AuthenticationGatewayFilter.kt:39`). 그래서 만료 토큰이 광고 호출에서 로그인 리다이렉트를 부르는 일도 없다 |
| R2 HOUSE 이관 | **해소** | 전용 소재 형식 (spec.md:121) · 목록 응답과 6초 순환 (:122) · 빈도 면제 (:120) · `game-detail-banner`·REWARDED 는 옮기지 않음 (:123). AC-16 (requirements.md:95), F2·I13·E3 |
| R3 결정 실패·unfilled | **대부분 해소** | 실패·빈 200 → AdSense, unfilled → HOUSE (spec.md:134-135), AC-6 (requirements.md:84), F1. **③ 결정 대기 중 자리 예약은 여전히 없다** → N7 |
| R4 카테고리·카탈로그 | **해소** | 카테고리 소유·매핑·기본값 (spec.md:58) · 광고주 카탈로그 API (:59) · 콘솔에서 선택 (:139) · `attraction-end`·`deal-hub-end` 판단 (:54) |
| R5 상태 전이 | **해소** | Campaign 전이 (spec.md:45) · `revise()` 로 수정 중 게재 중단 (:46) · 정지 광고주 조회 허용 (:37) · 첫 화면 정지 안내 (:138). U8·U9·U13 |
| R6 엣지 | **대부분 해소** | 빈도는 가시 노출 수락 때 올림 (spec.md:94) · 클릭 토큰 별도 발급 (:74) · 수명 2시간 (:76) · 인용 정정 (:87). **호스트별 빈도라는 명시는 여전히 없다** → N5 |
| R7 추적성 | **부분 해소** | AC ↔ 테스트 표 추가 (test-quality.md:85-110). 동시 충전 경계 등 빈칸이 남았다 → N6 |
| R8 콘솔 사전 조건 | **해소** | TLS hosts·proxied DNS (spec.md:33, :138) · 세 가지 첫 화면 (:138) |

## 새 이슈 · 남은 이슈

### N1 — 되돌리기 절차가 3단계 뒤에는 맞지 않고, 2단계 안의 배포 순서가 없다 (체크 2)

- 스펙: 「4 전까지 되돌리기는 게이트웨이 라우트를 content 로 되돌리는 것 하나다」 (spec.md:129)
- 코드: content 의 광고 컨트롤러에는 `GET /placements/{key}` 와 `/rewards` 두 경로만 있다 (`game/.../AdController.kt:35`, `:42`, `:58`). 3단계에서 FE 가 `decisions` 로 넘어간 뒤 라우트만 content 로 되돌리면 다음 일이 생긴다
  - `POST /api/v1/ads/decisions` 가 404 가 된다. AdSlot 은 SR-14 의 실패 흐름으로 AdSense 로 넘어가니 괜찮다. 그러나 HouseBanner 는 HOUSE 목록을 결정 응답에서만 받으므로 **배너가 사라진다**. 이는 AC-16 (requirements.md:95) 위반이다
  - 이미 발급된 클릭 토큰의 `GET /api/v1/ads/click/{token}` 이 content 에서 404 가 된다. 방문자는 랜딩이나 `/` 대신 오류 화면을 본다. SR-9 의 「서명이 틀리면 `/`」(spec.md:89)도 지켜지지 않는다
- 2단계 순서: 「ads 배포 + 게이트웨이 `/api/v1/ads/**` → engagement」(spec.md:126)가 한 단계로 묶여 있다. 한 커밋이면 Argo 가 두 이미지를 동시에 굴린다. 게이트웨이가 먼저 바뀌면 engagement 가 아직 뜨지 않았거나 ads 시드가 들어가기 전이다. 그러면 게이트웨이가 빈 200 을 낸다 (gateway/CLAUDE.md). 옛 HouseBanner 는 그 응답에서 `placement` 가 비어 아무것도 그리지 않는다 (`HouseBanner.tsx:14-16`, `:26`)
- 수정안
  - 되돌리기를 둘로 나눈다. 「2단계까지: 라우트만 되돌린다」, 「3단계 뒤: portal-fe 이전 이미지와 라우트를 함께 되돌린다」
  - 2단계를 두 번의 푸시로 나눈다. ① engagement(ads + 시드)를 올리고 `flyway_schema_history` 와 `/api/v1/ads/placements/game-list-banner` **바디 길이**를 확인한다 ② 그 뒤에 게이트웨이 커밋을 올린다. 이 확인을 태스크 검증 줄로 적는다

### N2 — 퍼블리셔 리포트의 채움률·HOUSE 대체율을 서버가 알 수 없다 (체크 3 · 4)

- 스펙: 결정 단계의 Redis 스크립트가 지면별 요청·채움 카운터를 올린다 (spec.md:69). 지면 시간별 집계는 「요청·채움·대체(HOUSE) 수」를 담는다 (spec.md:100). 퍼블리셔 리포트는 「채움률·HOUSE 대체율」을 보여 준다 (spec.md:116). AC-13 은 퍼블리셔 리포트의 채움률이 정산 표와 같기를 요구한다 (requirements.md:92)
- 모순: AdSense 로 채울지 HOUSE 로 채울지는 **FE 가 결정 응답을 받은 뒤** AdSense 의 `data-ad-status` 를 보고 정한다 (spec.md:134-135). 결정 시점의 서버는 「유료 없음 + HOUSE 목록을 줬다」까지만 안다. `blog-post-end`·`game-hub-end` 는 AdSense ID 가 있다 (`copy.mjs:1093`, `:1095`). 이 지면에서 HOUSE 는 unfilled 일 때만 보이므로 서버가 셀 수 없다. AdSense 가 채운 노출은 서버 집계에서 「미채움」으로 잡힌다
- 결과: 퍼블리셔 리포트의 「HOUSE 대체율」은 정의가 없는 수이고, 「채움률」은 AdSense 가 채운 몫을 빼고 센다. 그런데 이 점이 어디에도 적혀 있지 않다
- 수정안(둘 중 하나를 고른다)
  - (a) 채움률을 「자체 유료 낙찰 / 요청」으로 정의하고 AdSense 는 제외한다고 적는다. HOUSE 대체율은 리포트에서 뺀다
  - (b) FE 가 지면마다 최종 결과(`paid|adsense|house|hidden`)를 이벤트 엔드포인트로 보낸다. 과금하지 않는 채움 기록으로 받고, 이를 집계 원천으로 삼는다. 이 경우 AC 와 F·I 테스트를 한 줄씩 더한다

### N3 — 운영자 흐름에 화면과 API 목록이 없다 (체크 1 · 2)

- 운영자 스토리 (spec.md:16-17) 에 걸린 행위가 SR 곳곳에 흩어져 있다
  - 소재 심사 (spec.md:46)
  - 광고주 정지 (:36)
  - 지면·최저가 관리 (:53)
  - **카테고리 매핑 표 「어드민 관리」** (:58, 개정 2 에서 새로 생김)
  - HOUSE 캠페인 생성 (:120)
  - 미등록 지면 (:57)
  - 퍼블리셔 리포트 (:116)
- 광고주 콘솔은 화면 목록이 있다 (spec.md:139). 반면 admin-fe 는 「심사 큐」 한 마디(:136)와 견본 파일(`Sidebar.tsx`·`App.tsx`, :176)뿐이다. `/api/v1/admin/ads/**` 도 라우트 prefix 만 있고 엔드포인트가 없다 (:130). AC-15 는 「어드민의 미등록 지면 목록」 화면을 전제한다 (requirements.md:94)
- 문맥 키 형식은 블로그 예시(`blog:{카테고리 slug}`) 하나뿐이다 (spec.md:58). game·place 페이지가 무엇을 보낼지 없어서, 운영자가 매핑 표에 무엇을 넣을지도 정할 수 없다
- 수정안: SR-14 옆에 「어드민 화면」 절을 둔다. 내용은 심사 큐 · 광고주(정지/해제·사유) · 지면(최저가·활성) · 카테고리 매핑 · HOUSE 캠페인·소재 · 미등록 지면 · 퍼블리셔 리포트와 그 API 목록이다. 호스트별 문맥 키 형식 표(blog·game·place)를 SR-5 에 한 줄씩 더한다

### N4 — `deal-hub-end` 는 등록하지 않는데 FE 호출처가 남는다 (체크 5)

- 스펙: `deal-hub-end` 는 등록하지 않는다 (spec.md:54). AdSlot 은 지면 키를 받아 결정 호출에 넣는다 (spec.md:133). 등록부에 없는 키는 「미등록 지면」으로 누적된다 (spec.md:57)
- 코드: DealPage 가 AdSlot 을 그린다 (`portal-fe/src/pages/deal/DealPage.tsx:226`, `ADSENSE_SLOTS.dealHubEnd`). AdSense ID 는 일부러 빈 값이다 (`copy.mjs:1110`)
- 결과: 3단계 뒤 혜택 허브를 볼 때마다 쓸모없는 결정 호출이 나간다. 어드민의 미등록 지면 목록 맨 위에 `deal-hub-end` 가 영구히 남는다. 그러면 운영자가 이를 「등록할 것」으로 오독하기 쉽다. 미등록 목록은 원래 FE 오타를 찾으려는 장치라서 이 잡음이 그 목적을 가린다
- 수정안: SR-14 에 「DealPage 의 AdSlot 은 결정 호출 없이 AdSense 전용으로 둔다(또는 제거)」를 적는다. 아니면 등록부에 `deal-hub-end` 를 `활성=false`(자체 광고 금지) 행으로 두어 미등록과 구별한다. 후자를 고르면 [[no-config-rows-for-never-shown]] 과 부딪히므로 전자를 권한다

### N5 — 방문자 ID 경계 (R6 잔여 + 새 엣지) (체크 5)

- (a) 호스트별 빈도: `vid` 는 domain 속성 없이 설정되어 host-only 쿠키다 (`VisitorIdFilter.kt:34-39`). 그래서 빈도 제한 「방문자당 하루 3」(spec.md:44)과 클릭 속도 제한(:92)은 서브도메인마다 따로 센다. 스펙은 여전히 이 점을 적지 않았다 (spec.md:62). 광고주 콘솔의 설명 문구와 AC-5 해석이 이 사실에 달려 있다
- (b) 새 방문자의 첫 페이지: 쿠키가 없는 요청마다 게이트웨이가 새 UUID 를 만들어 `Set-Cookie` 한다 (`VisitorIdFilter.kt:24-25`, `:33-41`). 첫 페이지의 병렬 API 호출 중 하나가 결정 호출이면, 토큰에 서명된 방문자 해시와 브라우저에 마지막으로 남은 `vid` 가 다를 수 있다. 그러면 그 노출은 `visitor_mismatch`(spec.md:78)로 거절된다. 과소 청구라 안전하지만, 거절 사유 지표에 「첫 방문 노출」이 섞여 무효 트래픽 신호가 오염된다. 받아들인다고 적거나, 결정 호출을 페이지의 첫 API 응답 뒤로 미룬다고 적는다
- (c) 본인 판정은 결정 호출에 Bearer 가 실린다는 전제 위에 있다 (spec.md:81-82). 그런데 AdSlot 이 공유 `apiClient` 를 쓴다는 문장이 없다 (`apiClient.ts:17-23` 가 Bearer 를 붙이는 유일한 곳). `fetch`·`sendBeacon` 으로 구현하면 본인 판정이 다시 조용히 죽는다. C4 는 게이트웨이 아래만 보므로 FE 쪽 선택을 잡지 못한다. SR-14 에 한 줄 적고, F1 에서 요청에 `Authorization` 이 실리는지 확인한다

### N6 — 테스트 매핑 빈칸 (R7 잔여) (체크 4 · 6)

- 동시 충전: 하루 한도 경계를 동시 요청 두 건이 함께 넘는 경우가 여전히 없다. SR-3 에는 한도 판정의 직렬화 규칙(지갑 행 `FOR UPDATE` 안에서 KST 당일 합을 읽는지)이 없다 (spec.md:39). U12 는 순차 경계만 보고 (test-quality.md:31), I3 는 정산과 충전의 조합이다 (:40). AC-2 (requirements.md:80) 에 대응하는 I-동시충전을 더하고, SR-3 에 잠금 규칙을 적는다
- AC-3 「잔액보다 큰 일예산도 저장되고, 잔액이 비면 게재가 멈춘다」는 U8·E1 에 매핑되어 있다 (test-quality.md:91). 그러나 U8 은 상태 전이 테스트다 (:27). 저장 성공과 잔액 0 일 때 후보에서 빠지는 것을 보는 테스트가 없다
- AC-14 「반려는 사유가 광고주에게 보인다」: U9·U13·I6 어느 것도 광고주 API 응답의 사유 필드를 보지 않는다 (test-quality.md:28, :32, :43)
- SR 은 있는데 테스트가 없는 것: 에셋 응답 헤더 `nosniff`·불변 캐시·Content-Type (spec.md:137) · 콘솔 `noindex` 와 `ADSENSE_HOSTS` 에서 빠졌는지 (:138) · 클릭 302 의 `no-store`·`X-Robots-Tag` (:89, I9 는 목적지만 본다)
- N1 의 전환 순서는 I18(호환 응답 모양)만으로는 검증되지 않는다. 운영 검증 E 행에 「2단계 ①② 사이 바디 길이 확인」을 둔다

### N7 (경미) — 결정 대기 중 자리 · ADR 문장 불일치

- R3 ③이 남아 있다. 결정 호출을 최대 800ms 기다리는 동안(spec.md:133) 자리를 잡아 둘지 정해지지 않았다. 지금 AdSlot 은 AdSense ID 가 있을 때만 `minHeight` 로 자리를 잡는다 (`AdSlot.tsx:58-63`). 숨김으로 끝나면 레이아웃이 한 번 움직이는데, 이를 받아들일지 한 줄로 적는다
- ADR-0098 §6 의 채움 순서 문장에는 「AdSense unfilled → HOUSE」가 없다 (`ADR-0098-ad-network.md:71`). 스펙(spec.md:135)과 맞춘다

## Round 2 요약

Round 1 의 8건 중 6건이 해소됐다(R1·R2·R4·R5·R8 전부, R3·R6 대부분). R7 은 표가 생겼고 빈칸이 남았다. 새로 나오거나 남은 것은 7건이다(수정 필요 6 · 경미 1). 차단할 것은 없고, 모두 스펙 문장으로 고칠 수 있다.

가장 무거운 것은 두 건이다.

- N1: 되돌리기가 「라우트 한 줄」이라고 적혀 있지만, 3단계 뒤에 그대로 하면 HOUSE 배너가 사라지고 클릭이 404 로 끝난다
- N2: 퍼블리셔 리포트의 채움률·HOUSE 대체율은 서버가 관측할 수 없는 사건을 센다

VERDICT: REVISE

---

# Round 3 — 개정 3 최종 재리뷰 (2026-09-23)

- 대상: spec.md 개정 3 · requirements.md · test-quality.md 개정 3 · open-questions.yml · ADR-0098
- 확인한 코드: `k8s/overlays/oci-arm/kustomization.yaml:283-290, :332-349` (sync-wave) · `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:261-283` (rt) · `portal-fe/src/shell/apiClient.ts:6,13` · `portal-fe/src/components/ads/AdSlot.tsx:36-58` · `gateway/src/main` 의 Host 조건 사용처(0건)
- 인용한 라인 번호(spec.md:NN)는 개정 3 기준이다

## Round 2 항목 해소 확인

| # | 판정 | 근거 (개정 3) |
|---|---|---|
| N1 되돌리기·2단계 순서 | **해소** | 되돌리기를 3단계 앞/뒤로 나눴고 클릭 토큰 404 손실을 받아들인다고 적었다 (spec.md:137). 2단계 순서는 푸시를 둘로 나누는 대신 Argo sync-wave 로 보장한다 (spec.md:134). 코드와 맞는다. engagement 는 wave 9 (`kustomization.yaml:283-290`), gateway 는 wave 20 (`:342-349`)이다. 주석에도 「라우트는 목적지가 이미 있을 때만 유효」라는 같은 의도가 적혀 있다 (`:332-337`). engagement 가 Healthy 가 되지 못하면 wave 9 에서 멈추므로 게이트웨이는 옛 라우트로 남는다. 내 수정안(푸시 둘)보다 단순하고 더 안전하다 |
| N2 채움률 관측 | **해소** | (a)+(b) 혼합이다. 리포트는 「유료 채움률(서버가 아는 값)」과 「FE 보고 최종 채움 출처(참고치)」를 나눠 표기한다 (spec.md:124). 이벤트는 채움 출처를 받고 (:96), 집계는 이를 참고 열에 둔다 (:108). 요구사항 쪽 AC-13 문구 불일치는 아래 C2 에 남긴다 |
| N3 운영자 흐름 | **해소** | admin-fe 화면 7종과 API prefix (spec.md:155) · 1분 반영 (:156) · 호스트별 문맥 키 형식 blog·game·place (:61) |
| N4 `deal-hub-end` | **해소(방식은 C1)** | 비활성 행 + 사유 `placement_inactive` + 미등록 목록 제외 (spec.md:57, :73) · I11 (test-quality.md:53). 운영자 오독 문제는 풀렸다. 다만 내가 권하지 않은 쪽을 골랐다 → C1 |
| N5 방문자 경계 | **해소** | (a) 호스트 단위 빈도를 받아들인다 (spec.md:65) · (b) 첫 방문 `visitor_mismatch` 를 받아들이고 비율을 메트릭으로 본다 (:81, :157) · (c) `apiClient` 필수, 생 `fetch` 금지 (:86) + F2 (test-quality.md:85) |
| N6 테스트 빈칸 | **해소** | 동시 충전 잠금 규칙 (spec.md:40) + I3 (test-quality.md:45) · 잔액 0 후보 제외 I8·U17 (:50, :37) · 반려 사유 I19 (:61) · 에셋 헤더 I23 (:65) · 클릭 헤더 I12 (:54) · 콘솔 `noindex`·첫 화면 F7 (:90). 2단계 순서 확인은 sync-wave 로 바뀌어 E 행이 필요 없다 |
| N7 대기 자리·ADR | **해소(문구는 C3)** | 대기 중 최소 높이를 둔다 (spec.md:140) · ADR §6 에 unfilled → HOUSE 가 들어갔다 (`ADR-0098-ad-network.md:71`) |

## 개정 3 에서 새로 생긴 것

차단할 결함은 없다. 아래 셋은 태스크를 만들 때 한 줄씩 고치면 되는 이월 항목이다.

### C1 — `deal-hub-end` 비활성 행은 사용자 규칙과 부딪힌다 (체크 3)

- 스펙: 「`deal-hub-end` 는 **비활성 행**으로 등록한다」 (spec.md:57)
- 규칙: [[no-config-rows-for-never-shown]] 는 「"노출 안 함"으로 결정한 항목을 그 노출용 테이블에 비노출 상태로 심지 않는다」고 한다. 비노출 상태는 「운영 중 잠시 내리는 전환용」이라고 구분한다. 스펙은 이 지면을 「자체 광고에도 같다」는 이유로 영구히 막았다. 그러면 이 행은 잠시 내린 지면이 아니라 결정을 보관하는 행이다
- 흐름 비용: 이 행을 없애도 흐름은 더 단순해진다. 현행 `AdSlot` 은 AdSense ID 가 없으면 `null` 을 그린다 (`AdSlot.tsx:58`). DealPage 의 지면은 ID 가 일부러 비어 있다 (Round 2 N4 인용). 그러므로 DealPage 에서 `AdSlot` 을 빼거나 결정 호출을 하지 않게 하면 된다. 그러면 행도, 사유 `placement_inactive` 도, 버려지는 결정 호출도 사라진다
- 이월: 태스크를 만들 때 사람이 고른다. 행을 두기로 하면 spec 에 규칙 예외를 한 줄 적는다. 없애기로 하면 SR-5·SR-6 사유 목록과 I11 에서 `placement_inactive` 를 뺀다

### C2 — 게이트웨이 Host 조건이 로컬 k3s-lite 와 E2E 경로를 막는다 (체크 2 · 5)

- 스펙: 「ads 공개 라우트는 **Host 조건으로 proxied 호스트만** 받는다 … 헤더가 없는 환경(k3s-lite)은 `remoteAddress`」 (spec.md:92)
- 모순: 두 번째 문장은 k3s-lite 에서도 광고 라우트가 동작한다고 전제한다. 그런데 허용 목록이 운영 호스트(`*.1989v.com`)로 고정되면 로컬 host(localhost·nip.io)는 404 가 된다. FE 는 상대 경로로 부르므로 (`apiClient.ts:6,13`) 요청의 Host 는 페이지 호스트 그대로다. 게이트웨이에는 Host 조건을 쓴 라우트가 아직 없다(`gateway/src/main` 검색 0건). 그래서 참고할 선례도 없다
- 위협은 실재한다. `rt.1989v.com` 은 `/` 전체를 gateway 로 보낸다 (`commerce-platform.yaml:278-283`)
- 이월: 허용 목록이 아니라 **거부 조건**으로 적는다(`rt.1989v.com` 이면 404). 또는 허용 목록을 overlay 별 설정값으로 두고 기본값을 비워 전부 허용한다. 어느 쪽이든 C4 의 「Host 조건」 검사 기대값을 그 모양에 맞춘다. 허용 목록을 고르면 광고를 싣는 호스트(apex·blog·game 경로·place·deal·ads)를 빠짐없이 적어야 한다. 하나라도 빠지면 그 호스트의 지면만 조용히 AdSense 로 떨어진다. 실패 흐름이 이를 가려 주므로 눈에 띄지 않는다

### C3 (경미) — 문구 두 곳

- AC-13 은 여전히 퍼블리셔 「채움률」이다 (requirements.md:92). 스펙은 「유료 채움률」과 참고치를 나눴다 (spec.md:124). AC 문구를 스펙에 맞춘다
- 「대기 중에는 지면 최소 높이를 비워 둔다(레이아웃 밀림 없음)」 (spec.md:140). 그런데 채움 순서의 끝은 「자리 숨김」이다 (:141). 숨길 때는 자리가 접히며 한 번 밀린다. 지금은 ID 가 없는 지면을 처음부터 그리지 않는다 (`AdSlot.tsx:58`). 그래서 `attraction-end` 처럼 ID 가 없는 지면은 이 변경으로 새로 밀림이 생긴다. 「숨김으로 끝나면 한 번 접힌다 — 받아들인다」로 고치거나, 숨김 대신 빈 자리를 유지한다고 적는다

## Round 3 요약

Round 2 의 7건(N1~N7)은 모두 해소됐다. N1 의 배포 순서는 기존 sync-wave(engagement 9 → gateway 20)로 풀었고, 코드로 확인했다. 개정 3 에서 새로 생긴 것은 이월 3건이다. C1 은 사용자 규칙과의 충돌이고 사람이 고른다. C2 는 Host 조건의 모양이다. C3 은 문구다. 셋 다 태스크를 만들 때 한 줄로 고칠 수 있다. 흐름을 틀리게 만드는 결함은 없다.

VERDICT: SHIP
