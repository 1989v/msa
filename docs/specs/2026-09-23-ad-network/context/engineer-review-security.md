# Engineer Review — Security

- 대상: `docs/specs/2026-09-23-ad-network/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`, `context/concepts.md`, `docs/adr/ADR-0098-ad-network.md`)
- 차원: security (`reviewers/security/checklist.md`, skillsets 없음)
- 일자: 2026-09-23
- KB: `kb-search.sh` 는 이 리뷰어에 셸 도구가 없어 실행하지 못했다. 대신 `HNS_KB_PATH`(`.claude/hns-hooks.env:10`) 볼트의 `wiki/` 를 직접 검색했고, 표준으로 [[anonymous-identity-headers]] (updated 2026-09-20) 를 적용했다. 광고·클릭 사기·HMAC 토큰을 다룬 개념 페이지는 볼트에 없다.

## 요약

기본 골격은 탄탄하다. 광고주 HTML/JS 를 받지 않는 결정(ADR-0098 §2), https 전용 랜딩(SR-3), 서명 토큰 + 일회성 표식(SR-7), 신원 헤더를 벗기는 게이트웨이 필터(`AuthenticationGatewayFilter.kt:86-89`)가 자리를 잡았다. 남은 문제는 **스펙 문장이 보안 결과를 정하지 않은 곳**이다. 구현자가 흔한 방식으로 채우면 구멍이 생긴다. 차단 사유는 없고 모두 스펙 문장을 고치면 된다.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 (STRIDE) | 부분 | IVT·위조·재사용(SR-7/8)은 다룬다. 예산 소진 공격, 광고주 문자열이 들어가는 저장형 XSS, 오픈 리다이렉트는 다루지 않는다 → S2·S3·S5 |
| 2 | 인증/인가 경계 | 부분 | 공개/로그인/어드민 3단은 있다(SR-13 `spec.md:104`). 소유권 검사와 라우트 선언 순서가 없다 → S6 |
| 3 | 민감 데이터 흐름 | 부분 | 방문자 ID 90일 보관을 방침에 적는데(SR-16 `spec.md:121`), 그 값을 저장하는 곳과 지우는 곳을 스펙이 정하지 않는다 → S7 |
| 4 | 입력 검증 바운더리 | 부분 | 이미지 검증 방식과 서빙 헤더, 텍스트 렌더 규칙이 없다 → S3·S4 |
| 5 | 서비스 간 통신 | 통과 | 결정 경로에 외부 호출이 없다(SR-5 `spec.md:55`). 폴드 불변식에 따라 같은 JVM 의 빈을 직접 주입하지 않는다(SR-1 `spec.md:24`) |
| 6 | 시크릿 관리 | 통과(보완 1) | `ADS_TOKEN_SECRET`, 시크릿이 없으면 기동 실패, SealedSecret 을 먼저 넣는 순서(OQ-003)가 있다. 키 분리와 교체는 S1 |
| 7 | 암호화/해싱 | 부분 | HMAC 알고리즘, 상수 시간 비교, 클릭 토큰 정의가 없다 → S1 |
| 8 | 감사 로깅 | 미흡 | 심사·정지·HOUSE 생성을 누가 했는지 남기지 않는다 → S8 |
| C1 | 결제 PCI-DSS | 해당 없음 | 실제 결제가 없다(가상 크레딧, `requirements.md:42`) |
| C2 | 변경 시 권한 검증 | 부분 | ACTIVE 인지는 보지만 캠페인·소재가 요청자 소유인지는 보지 않는다 → S6 |
| C3 | Rate Limiting / Abuse | 미흡 | 모든 제한이 방문자 ID 에 걸려 있는데, 방문자 ID 는 쿠키를 바꾸면 새로 생긴다 → S2 |

## Findings

### S1 (#7·#6) 토큰 설계 문장이 모자라다 — 클릭 토큰 정의, 비교 방식, 키 분리, 가격 노출
- 근거: SR-7 `spec.md:66` 은 노출 토큰만 정의한다. `spec.md:69` 의 `clickToken` 은 무엇을 서명하는지, 수명이 얼마인지, 한 번만 쓰이는지 정의가 없다. SR-8 `spec.md:76` 의 「10분에 N회」만 있으면 같은 클릭 토큰을 한도 안에서 반복해 과금할 수 있다. test-quality U9 도 노출 토큰만 본다.
- 선례: 레포에 이미 HMAC 토큰이 있고 상수 시간 비교를 쓴다 — `game/.../party/HmacPartySeatTokenService.kt:36` (`MessageDigest.isEqual`), 시크릿이 없으면 기동하지 않는 가드는 `:27`.
- 수정안: SR-7 에 한 줄씩 더한다.
  1. 클릭 토큰은 노출 토큰과 같은 결정 ID 를 서명하고, `(결정 ID, CLICK)` 기준으로 한 번만 과금한다. 일회성 표식은 노출과 같은 방식으로 둔다
  2. HMAC-SHA256 을 쓰고 비교는 `MessageDigest.isEqual` 로 한다. 선례는 `HmacPartySeatTokenService`
  3. `ADS_TOKEN_SECRET` 은 다른 HMAC 키(`GAME_HMAC_SECRET`·`AUTH_SUBJECT_HASH_KEY`)와 따로 둔다. 최소 길이(32바이트)를 검사하고, 토큰에 `kid` 를 넣어 30분 동안 옛 키와 새 키가 함께 통하게 한다
  4. 토큰은 서명만 하고 암호화하지 않으므로 브라우저가 낙찰가를 읽을 수 있다. 이것을 수용한다고 적거나, 가격을 빼고 결정 ID 로 서버 쪽에서 찾게 한다

### S2 (C3·#1) 방문자 ID 는 어뷰징 방어가 아니다 — 경쟁 광고주의 예산을 태우는 공격이 열려 있다
- 근거: 빈도 제한(SR-5 `spec.md:49`)과 클릭 속도 제한(SR-8 `spec.md:76`)이 모두 `X-Visitor-Id` 를 키로 쓴다. 이 값은 게이트웨이가 `vid` 쿠키에서 읽고, 쿠키가 없으면 새로 만든다(`gateway/.../VisitorIdFilter.kt:24-25`). 쿠키를 지우거나 바꾸면 새 방문자가 된다.
- 표준: [[anonymous-identity-headers]] 는 「헤더는 못 건드리고 쿠키만 건드릴 수 있다 … 어느 쪽도 어뷰징 방어가 아니다」라고 정한다.
- IP 로 보완할 수도 없다.
  - 게이트웨이 리미터는 익명 요청을 `remoteAddress` 로 가른다(`RateLimiterConfig.kt:24-28`)
  - 그런데 이 클러스터에서 그 값은 klipper 파드 IP 다(`k8s/overlays/oci-arm/origin-lockdown/README.md:21-26`)
  - 그래서 익명 요청 전체가 버킷 하나를 나눠 쓴다
- 공격 경로:
  1. 결정 API 를 불러 경쟁 캠페인의 토큰을 받는다
  2. 그 토큰을 이벤트 API 에 낸다(가시 노출 여부는 클라이언트가 스스로 보고한다)
  3. `vid` 를 바꿔 가며 반복하면 CPM·CPC 둘 다 과금된다
- 크레딧이 가상이고 SIVT 가 비범위(`requirements.md:76`)라 차단 사유는 아니다. 그래도 스펙이 이 방어를 「무효 트래픽 방어」로 부르면 안 된다.
- 수정안:
  1. SR-8 에 잔여 위험을 적는다 — 「방문자 ID 기반 제한은 정직한 중복을 걸러낼 뿐이고 의도적인 소진은 막지 못한다」
  2. 토큰에 방문자 ID 를 넣어 서명하고, 이벤트를 받을 때 요청의 방문자 ID 와 다르면 `invalid_signature` 로 거절한다. 토큰만 모아 다른 클라이언트에서 내는 경로가 닫힌다
  3. 결정·이벤트·클릭 라우트에 게이트웨이 `requestRateLimiter` 를 걸고 키를 명시한다. `CF-Connecting-IP` 를 키로 쓰려면 먼저 `rt.` 호스트로 CF 를 우회해 이 헤더를 위조하는 경로를 막아야 한다(같은 README `:89-91`). 그 전까지는 「키 없음 = 전역 상한」이라고 적는다
  4. 캠페인마다 시간당 지출 상한을 둔다(예: 일예산 × 2 / 24). 넘으면 인덱스에서 뺀다. 소진 공격의 피해가 한 시간 몫으로 묶인다

### S3 (#4·#1) 광고주 문자열이 세 화면에 그려진다 — 텍스트로만 렌더하는 규칙이 없다
- 근거: ADR-0079 §1 `ADR-0079-single-login-origin.md:46-52` 에 따라 로그인 토큰은 JS 가 읽는 `.1989v.com` 쿠키다. 광고가 뜨는 면(blog·place·game·deal), 광고주 콘솔, admin-fe 심사 큐 어디서든 XSS 가 한 번 나면 전 서브도메인의 세션을 빼 간다. 심사 큐에서 나면 어드민 세션이다.
- SR-6 `spec.md:60` 의 「HTML·스크립트는 받지 않는다」는 **입력 형식**에 대한 결정이다. 제목·문구·반려 사유·랜딩 URL 을 어떻게 **출력**할지는 정하지 않았다. 광고 카드가 마크다운이나 `dangerouslySetInnerHTML` 로 그려지면 같은 구멍이 난다.
- 수정안: SR-3·SR-6·SR-12 에 넣는다.
  1. 제목·문구는 길이 상한을 두고, 모든 화면이 일반 텍스트로만 렌더한다. HTML·마크다운 해석은 금지하고, 광고 카드·콘솔·admin-fe 셋 다 적용한다
  2. 광고 카드의 `href` 는 랜딩 URL 이 아니라 **클릭 리다이렉터 주소**다. 랜딩 URL 이 DOM 에 직접 들어가지 않는다
  3. 랜딩 URL 은 저장할 때 `java.net.URI` 로 파싱해 검사한다 — https, 호스트 있음, userinfo 없음(`https://1989v.com@evil.example` 차단), 길이 상한. 서버는 이 URL 을 fetch 하지 않는다고 적는다(SSRF 없음 명시)

### S4 (#4) 이미지 업로드 — 검증 방식과 서빙 헤더가 없다
- 근거: SR-3 `spec.md:37` 은 「PNG·JPEG·WebP, 300KB 이하, 허용 비율」만 적었다. 스펙이 선례로 드는 gifticon 은 파일명 확장자를 그대로 믿는다(`gifticon/.../LocalImageStorageAdapter.kt:22`). 확장자나 `Content-Type` 헤더로 판정하면 이미지로 위장한 HTML·SVG 가 통과한다. 이 파일이 `/api/v1/ads/assets/{hash}` 에서 로그인 쿠키가 있는 오리진으로 나간다. 브라우저가 내용을 스니핑하면 저장형 XSS 가 된다. 레포 어디에도 `X-Content-Type-Options` 가 없다(grep 0건).
- 300KB 이하 PNG 도 픽셀 크기를 부풀려 디코딩에 수백 MB 를 쓰게 할 수 있다(압축 폭탄). engagement 는 768Mi 파드이고 추천·실험이 같은 JVM 에 있다.
- 수정안: SR-3 에 넣는다.
  1. 형식은 매직 바이트로 판정하고, `Content-Type` 은 저장한 형식 enum 에서 만든다
  2. 디코딩 전에 헤더에서 픽셀 크기를 읽고 상한(예: 2000×2000)을 넘으면 거절한다
  3. 가능하면 다시 인코딩해 메타데이터(EXIF 위치 포함)와 폴리글랏 꼬리를 떼어 낸다
  4. 서빙 응답에 `X-Content-Type-Options: nosniff` 와 `Content-Security-Policy: default-src 'none'` 을 붙인다
  5. test-quality U8 에 「확장자는 png 인데 내용이 HTML」「픽셀 폭탄」 두 케이스를 더한다

### S5 (#1·#4) 클릭 리다이렉트 — 「검증 실패여도 이동」이 오픈 리다이렉트를 열 수 있다
- 근거: SR-7 `spec.md:69`·AC-10 `requirements.md:88` 은 검증에 실패해도 랜딩으로 보낸다. 그런데 서명이 틀린 토큰의 소재 ID 는 믿을 수 없다. 구현이 토큰 페이로드에서 소재 ID 를 꺼내 그 랜딩으로 보내면, 공격자가 **반려된 소재**나 심사 전 소재의 URL 로 `1989v.com` 을 경유시킬 수 있다. 우리 도메인 링크가 피싱 미끼가 된다.
- 스펙이 따르겠다고 한 deal 리다이렉터는 목적지를 **서버 DB 에서만** 찾는다(`deal/.../DealRedirectService.kt:44-49`). 그래서 이 구멍이 없다. ADR-0079 §3(`ADR-0079-single-login-origin.md:68-74`)도 오픈 리다이렉트를 명시적으로 막는다.
- 수정안: SR-7 을 이렇게 쪼갠다.
  - 서명 유효 + 만료 → 서버가 그 소재를 조회해 **현재 `APPROVED`** 이면 랜딩으로 보내고 과금하지 않는다
  - 서명 무효·형식 오류 → 랜딩이 아니라 요청 호스트의 `/` 로 보낸다
  - 반려·삭제된 소재 → 역시 `/` 로 보낸다
  - 랜딩 URL 은 토큰에도 쿼리에도 싣지 않는다
  - test-quality I9 를 이 세 갈래로 나눈다

### S6 (#2·C2) 인가 — 소유권 검사, HOUSE 서버 강제, 라우트 순서
- 근거:
  - SR-2 `spec.md:29` 는 「요청자의 Advertiser 가 ACTIVE」만 요구한다. `campaignId`·`creativeId` 가 요청자 소유인지는 보지 않는다. 리포트 조회(SR-11)에도 같은 문장이 없다. 이대로면 IDOR 이 남는다
  - SR-3 `spec.md:35` 의 「HOUSE 는 어드민만」이 화면 규칙인지 서버 규칙인지 불분명하다. HOUSE 는 과금·예산 검사를 받지 않으므로(SR-12 `spec.md:101`) 광고주가 `priority=HOUSE` 를 보내 통과하면 무료로 무제한 게재된다
  - SR-13 `spec.md:104` 은 공개·로그인·어드민 라우트를 나눈다고만 했다. 광고주 API 의 경로 패턴과 선언 순서가 없다. [[anonymous-identity-headers]] 「캐치올」 절과 `gateway/CLAUDE.md` 「좁은 경로를 먼저 선언한다」에 따르면, 로그인 전용 경로가 공개 `/api/v1/ads/**` 뒤에 선언되면 인증이 조용히 약해진다. 이 레포에서 이미 두 번 났다
- 수정안:
  1. SR-2 에 「광고주 API 의 모든 읽기·쓰기는 대상의 `advertiserId` 가 요청자와 같을 때만 성공하고, 다르면 404」를 넣는다
  2. SR-3 에 「광고주 API 는 `priority` 를 입력으로 받지 않는다. HOUSE 는 `/api/v1/admin/ads/**` 에서만 만든다」를 넣는다
  3. SR-13 에 경로 표를 둔다. 예: 광고주 `/api/v1/ads/advertiser/**`(필수 인증, 먼저 선언) → 공개 `/api/v1/ads/{decisions,events,click,assets}/**`(optional 필터). 캐치올 `/api/v1/ads/**` 는 두지 않는다
  4. test-quality C2 에 「무인증 → 401」「위조 `X-User-Id` → 401」「남의 캠페인 id → 404」를 고정한다

### S7 (#3) 방문자 ID 보존·로그 — 방침 문구와 실제 저장소가 맞물리지 않는다
- 근거: SR-16 `spec.md:121` 은 `/privacy` §6 에 「방문자 ID·지면·시각, 90일」을 적는다. 그런데 스펙의 저장소는 Redis 카운터와 방문자 ID 가 없는 DeliveryHourly 뿐이다(SR-7 `spec.md:70-71`). 90일 동안 방문자 ID 를 갖는 표가 정의돼 있지 않다.
- 보존 배치 `RetentionRunner` 는 code-dictionary:app 에 있다(`ADR-0077-ledger-retention.md:112`). engagement 의 `ads_db` 는 지우지 않는다.
- ADR-0077 §4(`:83-86`)는 「방침에는 실제로 도는 것만 적는다」고 정한다. SR-15 `spec.md:117` 의 결정 ID 기반 로그에 방문자 ID 가 들어가면 그 로그도 보존 대상이 된다.
- 수정안: 둘 중 하나로 정한다.
  - (a) 원본 이벤트 표를 만든다 → 스키마, 90일 삭제 주체(engagement 안 스케줄러나 retention 배치 확장), 상수를 SR-9 근처에 명시한다
  - (b) 원본 표를 만들지 않는다 → 방침 문구를 「Redis 에 최대 하루 보관」으로 고친다
- 어느 쪽이든 「결정·이벤트 로그에 방문자 ID·회원 ID 원문을 남기지 않는다(결정 ID 만)」를 SR-15 에 넣는다.

### S8 (#8) 감사 기록 — 운영자 행위의 주체가 남지 않는다
- 근거: SR-12 `spec.md:99-101` 은 승인·반려·정지·HOUSE 생성을 정의하지만 누가 언제 했는지를 남기지 않는다. 원장 거래(SR-9 `spec.md:81-82`)에도 행위자가 없다. 반려 사유 분쟁이나 정지 해제 이력을 되짚을 수 없다.
- 수정안:
  1. Creative 에 `reviewedBy`·`reviewedAt` 을, Advertiser 상태 변경에 이력 행(행위자·사유·시각)을 둔다
  2. `TOPUP` 거래에 요청 회원 ID 를 둔다

### S9 (#1) sendBeacon 과 광고주 본인 제외가 서로 맞지 않는다
- 근거: SR-7 `spec.md:68` 은 `sendBeacon` 을 허용한다. `sendBeacon` 은 `Authorization` 헤더를 실을 수 없다. 로그인 토큰은 헤더로만 가고 쿠키 자동 전송에 기대지 않는다(ADR-0079 `:48`). 그래서 비콘 이벤트에는 `X-User-Id` 가 없고, SR-8 `spec.md:75` 의 「광고주 본인 노출은 과금하지 않는다」가 비콘 경로에서는 동작하지 않는다.
- [[anonymous-identity-headers]] 「가져갈 것 6」 — 규칙을 켠 것과 규칙이 닿는 것은 다른 사실이다.
- 수정안: 본인 여부는 **결정 시점**에 판정한다. 결정 요청은 fetch 라 헤더를 실을 수 있다. 결정 API 가 요청자 소유 캠페인을 후보에서 빼거나, 토큰에 `self` 플래그를 넣어 서명한다. 이벤트 단계에서는 판정하지 않는다.

### S10 (#1) Redis 장애 중 이벤트 처리가 정의되지 않았다
- 근거: 결정은 Redis 장애 시 유료 광고를 내지 않는다(AC-7 `requirements.md:85`). 그러나 이미 발급한 토큰의 이벤트(SR-7 `spec.md:68`)는 일회성 표식을 못 쓰는 상태에서 어떻게 처리할지 없다. 구현이 fail-open 으로 받으면 재사용 이벤트가 이중 과금된다.
- 수정안: SR-7 에 「일회성 표식을 확인할 수 없으면 과금하지 않고 거절 사유 `redis_unavailable` 로 센다」를 넣고, test-quality I4 에 이벤트 경로를 더한다.

## 판정

REVISE — 10건. 모두 스펙 문장으로 결과를 정하면 풀린다. 그중 먼저 고칠 것은 네 건이다.
- S3 텍스트 렌더
- S4 이미지 스니핑
- S5 리다이렉트 목적지
- S6 소유권·HOUSE

이 넷은 비워 두면 흔한 구현이 곧바로 세션 탈취나 무료 게재로 이어진다.

VERDICT: REVISE

---

# Round 2 — 개정 2 재리뷰 (2026-09-23)

- 대상: `spec.md` 개정 2, `planning/requirements.md`, `planning/test-quality.md` 개정 2, `context/open-questions.yml`, `docs/adr/ADR-0098-ad-network.md`
- 아래 줄 번호는 모두 **개정 2 기준**이다. 1차 본문의 줄 번호는 개정 1 기준이라 지금 파일과 맞지 않는다.
- 코드 대조: `VisitorIdFilter.kt:24-28`, `AuthenticationGatewayFilter.kt:33-46,86-90`, `RateLimiterConfig.kt:14-30`, `GatewayRouteConfig.kt:40-45,370-373`, `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml:9-11,264-283`, `k8s/overlays/oci-arm/kustomization.yaml:63-64`, `origin-lockdown/README.md:89-91`, `portal-fe/src/pages/games/HouseBanner.tsx:30`, `portal-fe/package.json`(react 19, react-router-dom 7), `tracker.ts:63-70`

## 1차 finding 해소 확인

| # | 판정 | 개정 2 근거 | 남은 것 |
|---|---|---|---|
| S1 토큰 | 대부분 해소 | 클릭 토큰 별도 발급·서명 필드 11개 `spec.md:74`, HMAC-SHA256 + `MessageDigest.isEqual` + 키 id 두 개 `:75`, 종류별 일회성 `:76`, 가격 노출 수용 `:77`, U11 | 키 길이·두 번째 키의 출처 → R2-5 |
| S2 소진 공격 | 부분 해소 | 잔여 위험 문장 `:95`, 방문자 해시 바인딩 `:78`·`visitor_mismatch` `:90`, 시간당 상한 `:64`, 리미터 키 명시 `:92` | 리미터 키가 위조된다 → R2-1 · 상한이 이벤트 단계에서 안 문다 → R2-2 |
| S3 텍스트 렌더 | 해소 | 텍스트 노드만·`dangerouslySetInnerHTML` 금지(콘솔·admin-fe 포함)·카드 href 는 리다이렉터 `:136`, 길이 상한 `:46`, URL 규칙 `:47`, F3·AC-19 | — |
| S4 이미지 | 부분 해소 | 매직 바이트 `:48`, 재인코딩·메타데이터 제거 `:48`, `nosniff`·형식 기반 Content-Type `:137`, U10 | 크기 검사가 디코딩 뒤에 있다 → R2-3 |
| S5 리다이렉트 | 해소 | 목적지는 DB 소재 URL, 비승인·서명 불량은 `/` `:89`, AC-10 `requirements.md:89`, I9 세 갈래 | — |
| S6 인가 | 해소(테스트 1줄 부족) | (id, 광고주 id) 조회·남의 것 404·요청 모델에 HOUSE/심사 필드 없음 `:38`, HOUSE 는 어드민 API 만 `:120`, 라우트 표·캐치올 제거 `:130`, I14·C3 | `advertiser/**` 무인증 401 이 C3 에 없다 → R2-6 |
| S7 보존 | 해소 | ads MySQL 에 방문자 단위 행 없음·Redis 25시간·방침 문구 `:151`, 로그는 해시만 `:150`, `requirements.md:47`, F5 | — |
| S8 감사 | 해소 | 정지 사유·행위자 `:36`, 심사 행위자·시각 `:46`, `TOPUP` 행위자 `:39` | — |
| S9 비콘·본인 | 해소 | 결정 시점 판정·토큰 `과금 여부=false` 서명 `:80-84`, ADR-0098 §8, C4 는 필터를 거친 신원으로 검증 | — |
| S10 Redis 장애 | 해소 | 이벤트 `redis_unavailable` 거절 `:93`, I4 이벤트 경로 | — |

## 새 finding·남은 finding

### R2-1 (C3·#5) `CF-Connecting-IP` 는 `rt.1989v.com` 으로 위조할 수 있다 — 리미터 키로 그대로 쓰면 제한이 없어진다
- 스펙: SR-9 `spec.md:92` 는 ads 공개 라우트의 게이트웨이 리미터가 `CF-Connecting-IP` 를 키로 쓴다고 정했다. 헤더를 믿어도 되는 조건은 적지 않았다.
- 코드:
  - `commerce-platform.yaml:278-283` — `rt.1989v.com` 은 CF 프록시를 거치지 않는(DNS-only, `:9-11`) 호스트이고, 경로 `/` 전체를 gateway 로 보낸다. `/api/v1/ads/**` 도 이 호스트로 닿는다
  - AOP(mTLS)는 `commerce-proxied` 에만 붙는다(`kustomization.yaml:63-64`). `rt` 에는 걸 수 없다고 README 가 적어 두었다(`origin-lockdown/README.md:89-91`)
  - CF 를 거치지 않은 요청의 `CF-Connecting-IP` 는 클라이언트가 넣은 값 그대로 gateway 에 도착한다
- 결과: 공격자가 `https://rt.1989v.com/api/v1/ads/decisions` 에 요청마다 다른 `CF-Connecting-IP` 를 넣으면 요청마다 새 버킷이 생긴다. 결정·이벤트·클릭 리미터가 사실상 꺼진다. 1차 S2 수정안 3이 전제로 둔 「rt. 우회 경로를 먼저 막는다」가 빠진 채 결론만 들어왔다.
- 수정안(SR-9 에 한 줄, 하나를 고른다):
  1. ads 공개 라우트에 호스트 조건을 붙여 `rt.1989v.com` 을 제외한다. 가장 작은 변경이다 — `rt` 는 WS/SSE 용이라 ads 가 쓸 일이 없다
  2. 또는 키 리졸버가 요청 Host 가 proxied 호스트일 때만 `CF-Connecting-IP` 를 쓰고, 아니면 전역 키 하나로 떨어진다
- 테스트: C3 에 「`rt` 호스트로 온 ads 요청 → 404(또는 전역 키)」, 「proxied 호스트에서 `CF-Connecting-IP` 값만 바꾼 요청 → 같은 버킷을 쓰지 않는다」 중 고른 쪽을 넣는다.

### R2-2 (C3·#1) 시간당 지출 상한은 결정 때만 보고, 지출은 이벤트 때 오른다 — 「손실 상한 = 시간당 상한」이 성립하지 않는다
- 스펙:
  - 상한 검사는 **결정의 후보 자격**에만 있다(SR-6 `spec.md:64`)
  - 지출 카운터는 **받아들인 이벤트**가 올린다(SR-9 `:94`)
  - 토큰 수명은 2시간이다(SR-7 `:76`)
  - 그런데 SR-9 `:95` 는 「손실 상한은 캠페인 시간당 지출 상한이다」라고 적었다
- 공격 경로: `vid` 를 바꿔 가며 결정을 여러 번 부른다. 이벤트를 아직 내지 않았으니 지출은 0 이고, 상한과 페이싱이 결정을 막지 않는다. 그렇게 토큰을 수천 장 모은 뒤 한꺼번에 제출한다. 토큰마다 방문자 해시가 맞으므로 모두 받아들여진다(`:78`). 시간당 지출이 상한을 넘어도 이벤트 단계에는 막는 곳이 없다.
- 실제 손실은 정산의 `min(지출, 일예산 잔여, 총예산 잔여, 지갑)`(SR-11 `:108`)이 정하는 **하루 예산 전액**이다. 스펙이 말한 한 시간 몫이 아니다.
- 수정안: SR-9 이벤트 수락에 한 줄을 넣는다 — 「이벤트를 받는 Redis 스크립트가 일회성 표식과 같은 호출에서 캠페인 시간·일 지출을 확인한다. 상한을 넘으면 받되 과금하지 않는다(`not_billable` 또는 새 사유 `cap_reached`)」. 그러면 `:95` 의 문장이 사실이 된다. I15 는 「상한 도달 뒤 **이미 발급된 토큰** 제출 → 과금 0」 케이스로 넓힌다. 회귀 주입 목록에 「이벤트 단계 상한 검사 제거 → 과금 초과가 잡힌다」를 더한다.

### R2-3 (#4) 「디코딩해 2000px 이하」 — 크기 검사가 디코딩 뒤에 있어 압축 폭탄이 그대로 통과한다
- 스펙: SR-4 `spec.md:48` 은 「디코딩해 가로세로 2000px 이하」라고 적었다. 1차 S4 수정안 2는 「**디코딩 전에** 헤더에서 픽셀 크기를 읽고」였다. 개정 문장을 흔한 방식(`ImageIO.read` 한 뒤 `width`·`height` 확인)으로 구현하면 20000×20000 PNG(300KB 안에 들어간다)가 먼저 약 1.6GB 버퍼를 잡는다. engagement 768Mi(SR-2 `:29`)의 추천·실험이 같이 죽는다.
- U10 `test-quality.md:29` 의 「2001px」은 정상 크기에 가까운 파일이라 이 경로를 재지 못한다.
- 수정안:
  1. SR-4 문장을 「`ImageReader` 로 헤더의 가로세로만 먼저 읽어 2000px 을 넘으면 디코딩하지 않고 거절」로 고친다
  2. U10 에 「300KB 이하 · 헤더 20000×20000 PNG → 디코딩 없이 거절」을 더한다
  3. (방어 한 겹 더, 선택) 에셋 응답에 `Content-Security-Policy: default-src 'none'` 을 SR-14 `:137` 에 더한다. 재인코딩이 있으니 필수는 아니다

### R2-4 (#4) HOUSE 링크 규칙이 서버 검증 문장이 아니다 — `//evil.example` 이 「앱 안 경로」로 통과한다
- 스펙: SR-13 `spec.md:121` 은 HOUSE 링크를 「앱 안 경로 `/…` 또는 https」, `:122` 는 「앱 안 경로는 SPA 링크로 그린다」고 적었다. 서버가 어떻게 검사하는지는 없다. 유료 소재의 URL 규칙(SR-4 `:47`)은 HOUSE 형식에 걸리지 않는다.
- 코드: 지금 `HouseBanner.tsx:30` 은 `<Link to={creative.href ?? '/'}>` 이고, react-router-dom 7(`portal-fe/package.json`)은 `//host` 로 시작하는 값을 외부 절대 URL 로 처리한다. `startsWith("/")` 로 검사하면 `//evil.example` 이 통과하고, 게임 목록의 「AD」 배너가 우리 도메인에서 외부로 나가는 링크가 된다. React 19 가 `javascript:` 는 막지만 이 경우는 막지 않는다.
- 위험도: 입력자는 어드민뿐이다(`:120`). 그래서 낮다. 그래도 규칙이 한 줄이면 끝난다.
- 수정안: SR-13 에 「HOUSE 링크는 `/` 로 시작하고 두 번째 글자가 `/`·`\` 가 아닌 앱 안 경로, 또는 SR-4 의 https 규칙을 통과한 URL 만 저장한다(어드민 API 에서 검사)」를 넣는다. U10 옆에 HOUSE 케이스 두 줄(`//evil.example`, `javascript:`)을 넣는다.

### R2-5 (#6) 키 교체를 약속했는데 시크릿은 하나다 — 이전 키의 출처와 최소 길이가 없다
- 스펙: SR-7 `spec.md:75` 는 「키 id 로 현재·이전 키 두 개를 받아 교체 중에도 검증한다」고 했다. 그런데 SR-2 `:31` 과 ADR-0098 §1 에는 `ADS_TOKEN_SECRET` 하나만 있다. 이전 키가 어느 환경변수로 들어오는지, 비어 있어도 되는지가 없다. 최소 길이 검사와 「다른 HMAC 키와 공유하지 않는다」는 1차 S1-3 도 반영되지 않았다.
- 선례: `HmacPartySeatTokenService.kt:27` 은 비어 있으면 기동을 거부한다.
- 수정안: SR-2 에 「`ADS_TOKEN_SECRET`(현재, 32바이트 이상이 아니면 기동 거부) · `ADS_TOKEN_SECRET_PREVIOUS`(선택, 교체 창 동안만) · 키 id 는 설정값 · 다른 서비스의 HMAC 키와 공유 금지」를 적는다. OQ-003 의 「셋」은 필수 시크릿 기준이라 그대로 둔다.

### R2-6 (#2) 광고주 라우트의 무인증 401 이 테스트에 고정돼 있지 않다
- 스펙: 라우트 표는 `advertiser/**` 를 「로그인」으로 둔다(`spec.md:130`). 그런데 C3 `test-quality.md:63` 은 공개 라우트의 게스트 필터와 헤더 제거, 선언 순서만 본다. 이 레포에서 로그인 경로가 공개 캐치올 뒤에 가려진 일이 두 번 있었다(`gateway/CLAUDE.md` 「좁은 경로를 먼저 선언한다」). 옛 `game-ads` 캐치올(`GatewayRouteConfig.kt:370-373`, `optionalUserConfig`)은 전환 4단계(`spec.md:128`)까지 코드에 남을 수 있다.
- 수정안: C3 에 「토큰 없이 `/api/v1/ads/advertiser/**` → 401」「클라이언트가 붙인 `X-User-Id` 만 있고 토큰은 없을 때 → 401」 두 줄을 더한다.

## 확인했고 문제없는 것 (새 설계)

- **방문자 해시 바인딩**: `X-Visitor-Id` 는 게이트웨이가 `vid` 쿠키로만 정하고 요청 헤더를 덮어쓴다(`VisitorIdFilter.kt:24-28`). 그래서 클라이언트는 헤더로 위조할 수 없고, 쿠키로만 바꿀 수 있다. `sendBeacon` 은 같은 오리진에 쿠키를 실어 보낸다(`tracker.ts:70`). 클릭 302 는 최상위 GET 이라 SameSite 기본값(Lax)에서도 쿠키가 간다. 바인딩이 막는 것은 「토큰을 모아 다른 브라우저로 옮기기」까지이고, 소진 공격은 막지 못한다. 이것은 `:95` 가 잔여 위험으로 적었다. 상한 문제는 R2-2 다.
- **토큰 비암호화**: 브라우저에 보이는 값은 가격·캠페인·소재·지면·방문자 해시·과금 여부다. 방문자 해시는 122비트 무작위 UUID 에서 나오고 `vid` 는 `httpOnly` 라 역산해도 얻는 것이 없다. `과금 여부=false` 는 본인에게만 나간다. 수용 문장 `:77` 으로 충분하다.
- **본인 판정**: `optionalUserConfig` 는 토큰이 없으면 `X-User-Id` 를 지우고(`AuthenticationGatewayFilter.kt:39,86-90`), 있으면 검증해 넣는다(`:76-79`). 결정 호출만 신원을 보고 이벤트는 토큰만 믿는 구조(`spec.md:82`)가 이 필터와 맞는다.
- **리다이렉터 목적지**: DB 조회만 쓰고 토큰·쿼리에 URL 이 없다(`:89`). deal 선례와 같다.

## 판정

REVISE — 6건. 전부 스펙 문장과 테스트 한두 줄로 풀린다. 사람이 판단할 결정은 없다.

| # | 한 줄 | 우선 |
|---|---|---|
| R2-1 | `CF-Connecting-IP` 가 `rt.1989v.com`(`commerce-platform.yaml:278-283`)을 거치면 위조돼 ads 리미터가 사실상 꺼진다 — `spec.md:92` | 높음 |
| R2-2 | 시간당 상한은 결정 때만 보고 지출은 이벤트 때 올라 토큰을 모아 두면 하루 예산 전액이 소진된다. `spec.md:95` 의 손실 상한 문장이 거짓이다 | 높음 |
| R2-3 | 「디코딩해 2000px」 — 헤더 선검사가 아니어서 압축 폭탄이 768Mi 공유 JVM 을 죽인다 — `spec.md:48`, U10 | 중간 |
| R2-4 | HOUSE 링크 서버 검증이 없어 `//evil.example` 이 앱 안 경로로 통과한다 — `spec.md:121`, `HouseBanner.tsx:30` | 낮음 |
| R2-5 | 키 교체를 약속했지만 시크릿은 하나고 최소 길이·공유 금지가 없다 — `spec.md:75` vs `:31` | 낮음 |
| R2-6 | `advertiser/**` 무인증 401 이 C3 에 없다 — `test-quality.md:63` | 낮음 |

VERDICT: REVISE

---

# Round 3 — 개정 3 최종 재리뷰 (2026-09-23)

- 대상: `spec.md` 개정 3, `planning/test-quality.md` 개정 3, `planning/requirements.md`, `context/open-questions.yml`, ADR-0098
- 줄 번호는 모두 **개정 3 기준**이다.
- 코드 대조: `commerce-platform.yaml:41-66,260-283` · `k8s/overlays/oci-arm/kustomization.yaml:63-64` · `origin-lockdown/aop-patch.yaml:16-21` · `origin-lockdown/README.md:78-79` · `ingresses/private-games.yaml:42,48` · `portal-fe/src/analytics/tracker.ts:55-70` · `identity.ts:8-9,38-44` · `gateway/.../VisitorIdFilter.kt:28` · `AuthenticationGatewayFilter.kt:77-78`

## 2차 finding 해소 확인

| # | 판정 | 개정 3 근거 |
|---|---|---|
| R2-1 rt 우회 | 해소 | SR-9 `spec.md:92` 가 Host 조건으로 proxied 호스트만 받고 `rt` 는 404 로 둔다. C4 `test-quality.md:74` 가 라우트 표에서 Host 조건을 검사하고, E6 `:101` 이 운영에서 `rt` 요청이 404 인지 본다. 코드로도 맞다. proxied 호스트는 `commerce-proxied` 한 Ingress 에만 있고(`commerce-platform.yaml:41-259`), 그 Ingress 에 AOP 가 걸려 있다(`aop-patch.yaml:19-20`, `kustomization.yaml:63-64`). 그래서 origin IP 에 직접 붙어 `Host: blog.1989v.com` 을 넣어도 CF 클라이언트 인증서가 없으면 통과하지 못한다 |
| R2-2 상한 우회 | 해소 | SR-10 수락 스크립트가 표식·방문자 해시·일/시간/총예산을 한 번에 검사하고, 넘은 몫은 `over_budget` 으로 처리한다(`spec.md:97`). 손실 상한 문장은 `:104` 에서 「수락 단계에서 강제」로 고쳤다. ★I7 `test-quality.md:49` 가 토큰을 모아 한꺼번에 내는 경우를 검사한다 |
| R2-3 이미지 폭탄 | 해소 | `spec.md:50` 이 헤더를 먼저 읽고 디코딩하지 않은 채 거절한다고 정했다. ★U12 `test-quality.md:32` 는 300KB 안의 20000×20000 PNG 에서 디코더 호출이 0 인지 보고, 회귀 주입 `:138` 도 있다 |
| R2-4 HOUSE 링크 | 해소 | `spec.md:129` 에서 서버가 `^/(?![/\\])` 또는 https(userinfo 금지)를 검증한다. U13 `test-quality.md:33` 이 `//evil.example`·`/\evil`·`https://u@x` 를 넣어 본다 |
| R2-5 키 | 해소 | `spec.md:31` 에 `ADS_TOKEN_SECRET_PREVIOUS`·32바이트 미만이면 기동 거부·공유 금지가 있다. U14 `:34`·C3 `:73` 이 짧은 키와 이전 키 검증을 본다 |
| R2-6 401 | 해소 | C5 `test-quality.md:75` 가 advertiser 무토큰 401 과 클라이언트 `X-User-Id` 제거를 보고, C4 `:74` 가 라우트 표 전체를 검사한다 |

## 개정 3 에서 새로 들어온 것 — 판정

### 확인했고 문제없는 것
- **이벤트 요청에 실리는 analytics 신원(서명 없음)** `spec.md:96,151`: 새 신뢰 경계가 아니다. 지금 analytics 수집 경로도 같은 값을 클라이언트가 보고한다. `tracker.ts:57-58` 은 헤더로, 비콘을 쓸 때는 `:67-68` 에서 본문으로 보내고, 출처는 localStorage 다(`identity.ts:8-9`). ads 는 이 값을 과금에 쓰지 않는다. 과금은 게이트웨이가 쿠키로 정하는 `X-Visitor-Id`(`VisitorIdFilter.kt:28`)의 해시와 토큰을 대조한다(`spec.md:81`). 사본은 수락된 토큰 하나당 한 건만 나가므로 증폭도 없다.
- **최종 채움 출처(서명 없음)** `spec.md:96,108,124`: 과금·정산·인덱스 어디에도 들어가지 않는다. 리포트는 이 값을 「참고치」로 표기한다. 값을 조작해도 참고 통계가 흔들리는 데서 끝난다.
- **Host 조건**: 위 R2-1 행에서 본 대로 AOP 와 맞물려 있어 성립한다.

### 이월 항목 (태스크를 만들 때 반영, 차단 아님)

**CO-1 (C3) 클라이언트가 보낸 키에 상한이 없다**
- 대상은 둘이다. 이벤트 본문의 「지면별 채움 출처」(`spec.md:96,108`)와 결정의 미등록 키 누적(`:60`, I11 `test-quality.md:53`)이다.
- 둘 다 키를 클라이언트가 정하고, 서명도 토큰도 없이 카운터를 만든다. 임의 키를 반복해 보내면 Redis 키와 `AdPlacementHourly`·미등록 목록의 행이 제한 없이 늘어난다. admin-fe 미등록 목록도 쓰레기로 찬다.
- 태스크 문장:
  1. 채움 출처는 **등록된 활성 지면 키 + enum 4종**만 받고, 나머지는 버린다
  2. 미등록 키는 kebab 정규식과 길이 64 이하를 통과한 것만 센다. 시각당 서로 다른 키는 N개(예: 50)까지만 둔다
  3. 한 요청의 토큰 수와 채움 항목 수에 상한을 둔다(예: 각 20). analytics 신원은 UUID 형식과 길이를 검사한 뒤 Kafka 에 싣는다

**CO-2 (#5) Host 조건이 무엇에 기대는지 적는다**
- `spec.md:92` 의 Host 조건은 `commerce-proxied` 에 AOP 가 있어야 성립한다(`kustomization.yaml:63-64`). AOP 가 없으면 origin IP 에 직접 붙어 proxied Host 를 넣는 경로가 다시 열린다.
- 롤백 절차 `origin-lockdown/README.md:78-79` 는 그 AOP 를 빼는 명령이다.
- 새 호스트 `ads.1989v.com`(`spec.md:34,145`)도 같은 조건을 탄다. 이 호스트는 **`commerce-proxied` 안의 rule 로** 더해야 한다. 별도 Ingress 로 만들면 AOP 패치(`aop-patch.yaml:16`, `target: commerce-proxied`)가 붙지 않는다.
- 태스크 문장:
  1. SR-9 에 한 줄을 넣는다 — 「proxied 호스트 판정은 AOP 가 전제다. AOP 를 롤백하는 동안 ads 리미터는 우회된다」
  2. ads 호스트는 `commerce-proxied` 에 추가한다고 적는다
  3. Host 조건은 `rt` 를 빼는 방식이 아니라 proxied 호스트 **허용 목록**으로 두고, 그 목록을 ingress 와 대조한다(콘솔이 에셋을 쓰므로 `ads` 포함)

**CO-3 (#4) HOUSE 링크 정규식이 제어 문자를 막지 않는다**
- `^/(?![/\\])`(`spec.md:129`)는 `"/\t/evil.example"` 을 통과시킨다. 브라우저는 URL 을 파싱할 때 탭과 개행을 지우므로(WHATWG URL) 이 값의 href 는 `//evil.example` 로 바뀐다. 새 탭으로 열거나 링크를 복사하면 외부로 나간다.
- 입력자가 어드민뿐이라 위험도는 낮다.
- 태스크 문장: 「공백·제어 문자(`\x00-\x1F`, `\x7F`)가 있으면 거부, 전체 일치(`matches`)로 검사」를 넣고, U13 에 탭 케이스를 하나 더한다.

## 판정

SHIP. 2차 6건은 모두 개정 3 문장과 테스트 행으로 해소됐다. 새로 들어온 서명 없는 필드 두 가지(analytics 신원·채움 출처)는 과금에 쓰이지 않아 신뢰 경계를 넓히지 않는다. Host 조건은 AOP 와 맞물려 성립한다. 남은 세 건 CO-1~3 은 모두 입력 상한과 문서화 한 줄이다. 태스크를 만들 때 넣으면 된다.

VERDICT: SHIP
