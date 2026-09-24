# Engineer Review — Security

- 대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 체크리스트: hns 0.15.1 `spec-review/reviewers/security/checklist.md` (+ skillsets: threat-model-analysis · sensitive-data-flow-trace · owasp-vulnerability-scan)
- KB: [[anonymous-identity-headers]] (게이트웨이 신원 헤더 신뢰 경계 · 캐치올 규율)
- 판정: **REVISE**. 차단급 결정 충돌은 없다. 다만 S1~S3 는 SR-0 단계 배포 전에 스펙에 반영해야 한다.

## STRIDE 요약

| 위협 | 진입점 | 기존 방어 | 스펙 공백 |
|---|---|---|---|
| Spoofing | 웹훅 `POST /api/v1/payments/webhooks/{pg}` | 서명 검증(spec.md:34) | 키 출처·운영 노출 여부가 없다 (S2) |
| Tampering | 상품 가격 `PUT /api/products/{id}` | 없음 (S1) | 서버 가격 원칙(ADR-0099 §5)이 우회된다 |
| Repudiation | 판매자 승인·정지·수수료율 | 주문 상태 이력(spec.md:60), 운영 큐 처리 기록(spec.md:76) | 판매자·역할 변경 이력이 없다 (S10) |
| Info Disclosure | 계좌 원문, 판매자 PII | 마스킹 + 암호화 컬럼(spec.md:40) | 키 관리·복호화 범위·방침 갱신이 없다 (S3, S8) |
| DoS | 주문 생성 → 재고 예약 15분 | 일부 라우트에만 레이트 리밋 | 재고 선점 남용 상한이 없다 (S7) |
| EoP | 역할 부여 이벤트, 판매자 정지 | 게이트웨이 역할 필터 | Kafka 로 권한 부여, JWT 역할 지연 (S4, S5) |

## Findings

### S1 [High] 상품 쓰기 경로에 권한 검사가 없어 서버 가격 원칙이 무력화된다 — 체크: 주문/재고 변경 권한 · 인가 경계
- 스펙 결정: 금액은 서버가 정한다(ADR-0099:61-63, spec.md:23). 판매자 API 는 자기 상품만 다룬다(spec.md:42).
- 코드: `ProductController.kt:28-65` 의 `POST /api/products`·`POST /bulk`·`PUT /{id}` 에 역할·소유자 검사가 없다. 게이트웨이는 `userConfig()`(ROLE_USER 이상)만 건다(`GatewayRouteConfig.kt:130-138`). 같은 곳의 주석 "ROLE_SELLER+ 검증은 service level 의 X-User-Roles 로 처리" 는 사실과 다르다 — `product/` 전체에서 `X-User-Roles` 를 읽는 곳이 0건이다.
- 결과: 로그인한 회원 누구나 가격을 1원으로 바꾼 뒤 주문서를 만들 수 있다. 주문서 스냅샷은 그 가격을 서버 가격으로 받아 적는다.
- 수정안: SR-2(또는 SR-0)에 한 줄 추가한다. 「기존 `/api/products` 쓰기는 ROLE_SELLER 이상 + `product.seller_id == 요청자 판매자` + 판매자 ACTIVE 일 때만 허용한다. 어드민은 예외다」. `/bulk` 는 search-batch 가 게이트웨이를 거치지 않고 직접 부르는 시드 경로라(`04-allow-backend-to-backend.yaml:5`) 게이트웨이에 노출되지 않는 `/internal` 경로로 옮긴다. `test-quality.md:27` 에는 「일반 회원의 가격 PUT → 403」과 「남의 상품 PUT → 403」을 추가한다.

### S2 [High] 웹훅의 서명 키 출처와 운영 노출이 정해지지 않았다 — 체크: Spoofing · 시크릿 관리 · 서비스 간 통신
- 스펙: 웹훅 서명 실패 시 401 이고 응답·재조회와 같은 전이 함수를 쓴다(spec.md:34). 운영은 모의 PG 다(ADR-0099:52-55).
- 근거: 레포가 PUBLIC 이다(ADR-0078:76). 공개 기본값으로 떨어지는 키가 이미 있다(`content/app/.../application.yml:112-115`, `SaveCipher.kt:42`). 같은 이유로 기본값을 제거한 전례도 있다(`game/CLAUDE.md` 「필수 시크릿」 — 기본값이면 "검사가 도는 채로 아무것도 막지 않는다").
- 위험: 운영에서 모의 PG 웹훅 경로가 공개돼 있고 키가 기본값이면, 누구나 `captured` 웹훅을 위조해 돈 없이 주문을 확정시킬 수 있다.
- 수정안:
  1. 웹훅 키는 PG 별 K8s Secret 으로 둔다. 없거나 기본값이면 기동하지 않는다(fail-fast).
  2. 웹훅은 트리거로만 쓴다. 상태와 금액은 `PgPort` 재조회 결과로 전이한다. 페이로드 금액 ≠ `payment.amount` 이면 운영 큐로 보낸다.
  3. `payment.pg=mock` 인 운영에서는 게이트웨이 웹훅 라우트를 열지 않는다. 모의 PG 의 지연 웹훅은 프로세스 안에서 전달한다.
  4. 라우트를 열 때는 `optionalUserConfig()` 로 신원 헤더를 벗기고 레이트 리밋을 건다.

### S3 [High] 계좌 원문 암호화 키 관리가 비어 있다 — 체크: 암호화/해싱 · 시크릿 관리 · 민감 데이터 흐름
- 스펙: "계좌번호 마스킹 저장, 원문은 암호화 컬럼"(spec.md:40). 요구사항에는 마스킹만 있다(requirements.md:52).
- 코드: `k8s/base/commerce/` 에 `AES_KEY`·`secretKeyRef` 가 0건이고 `commerce/app` 설정에도 `encryption.aes-key` 가 없다. 공용 `AesUtil`(`common/.../AesUtil.kt:10-26`)은 키를 주입받기만 하고, 레포의 관례적 기본값은 공개 문자열이다.
- 수정안: SR-2 에 다음을 적는다.
  - 판매자 계좌 전용 키를 Secret 으로 두고, 없거나 기본값이면 기동하지 않는다.
  - 암호문에 키 버전을 붙인다(`SaveCipher.kt:57-58` 의 `{"v":..,"c":..}` 봉투를 따라 하면 된다). 교체 절차를 도메인 `CLAUDE.md` 에 쓴다.
  - 이 키는 백업 대상이다. 잃으면 계좌 원문을 되살릴 수 없다(ADR-0078 §3 과 같은 성질).
  - 복호화는 정산 지급 경로에서만 한다. 어드민·판매자 API 응답, 로그, Kafka 페이로드에는 마스킹 값만 싣는다.

### S4 [Medium] 판매자 정지가 토큰 만료(최대 1시간)까지 먹지 않는다 — 체크: EoP · 인가 경계
- 스펙: 승인 시 `ROLE_SELLER` 를 부여하고 정지 시 회수한다(spec.md:41).
- 근거: 역할은 JWT 클레임으로 운반되고 access 수명은 3600초다(`auth/app/.../application.yml:52`, `AuthenticationGatewayFilter.kt:62-78`). ADR-0072:50-51 에 같은 문제가 이미 적혀 있다 — "권한 진실이 두 군데(JWT 클레임 + 프로필 행)로 갈리면 정지 처리가 토큰 만료 전까지 먹지 않는다".
- 수정안: `ROLE_SELLER` 는 게이트웨이의 1차 필터로만 쓴다. 판매자 쓰기, 클레임 승인, 정산서 조회는 요청마다 판매자 상태가 ACTIVE 인지 확인한다(`seller_db` 또는 product·order 가 가진 판매자 스냅샷 기준). 테스트 행에 「정지 직후 기존 토큰으로 상품 수정 → 403」을 추가한다.

### S5 [Medium] auth 에 Kafka 소비를 새로 붙이면 권한 부여 경로가 생긴다 — 체크: 서비스 간 통신 · EoP
- 스펙: `seller.seller.approved` 를 받아 auth 가 `ROLE_SELLER` 행을 추가한다(spec.md:41).
- 근거: auth 에는 지금 Kafka 소비가 없다(`auth/app/src/main` 에 `KafkaListener` 0건). 브로커는 앱 파드 전부에 열려 있다(`07-allow-app-to-kafka.yaml:29-33`, 인증 없음). 외부 :443 egress 가 열린 배치들(`11-allow-egress-https-public.yaml:33` — place-ingest·ranking-ingest·deal-linkcheck 등)도 여기에 포함된다. 게이트웨이 주석대로 auth 에는 자체 권한 검증이 없다(`GatewayRouteConfig.kt:87-88`).
- 수정안:
  - 컨슈머는 **고정된 `ROLE_SELLER` 만** 부여·회수한다. 페이로드에 역할 필드를 두지 않는다.
  - 이벤트에는 memberId·sellerId·eventId 만 싣는다. eventId 로 멱등 처리하고, 부여·회수를 eventId 와 함께 로그로 남긴다.
  - 「Kafka 무인증 → 파드 하나가 탈취되면 판매자 역할을 위조할 수 있다」를 ADR-0099 결과 절에 수용 위험으로 적는다. ADMIN 은 이 경로로 절대 부여하지 않는다는 불변식도 함께 적는다.

### S6 [Medium] 새 엔드포인트의 게이트웨이 라우트·인증 수준 표와 객체 수준 인가가 없다 — 체크: 인증/인가 경계 · 입력 검증
- 스펙이 새로 내는 경로: `/api/v1/order-sheets`(spec.md:48), `/api/v1/orders`(spec.md:55), 장바구니, 클레임, 판매자 포털(spec.md:44), 웹훅(spec.md:34), `/api/v1/admin/dlt`(spec.md:75).
- 근거: 기존 주문 경로는 `/api/orders` 다(`OrderController.kt:16`, `GatewayRouteConfig.kt:140-147`). `/api/v1/orders` 라우트는 없다. [[anonymous-identity-headers]] 규율 1·3: 「내 경로가 어느 라우트로 매치되나」를 직접 대 보고, 경계는 문서가 아니라 라우팅 스펙 검사로 지킨다. 이 레포에서 두 번 샜다.
- 수정안:
  1. SR-7 에 라우트 표(경로 → USER / SELLER / ADMIN / 공개+헤더 제거)를 넣는다. `GatewayRoutingSpec` 에 무인증 401, 역할 부족 403, 위조 `X-User-Id` 제거 검사를 추가한다.
  2. 객체 수준 인가를 명시한다.
     - 주문서 소유자 == `X-User-Id` (남의 `orderSheetId` 로 주문하면 404)
     - 사용자 쿠폰 소유자 확인
     - 클레임은 본인 주문에만 걸 수 있다
     - 판매자 승인은 자기 라인만, 판매자의 주문·정산서 조회는 자기 것만
  3. 신원 헤더가 없으면 거부한다(fail-closed). 현재 `OrderController.kt:51` 은 `userId != null &&` 조건이라 헤더가 없으면 아무 주문이나 반환한다. 이 모양을 새 API 에 복사하지 않는다.
  4. `Idempotency-Key` 는 길이·문자 집합을 검증한다(컬럼 길이 방어).

### S7 [Medium] 재고 선점 남용에 상한이 없다 — 체크: Rate Limiting / Abuse
- 스펙: 주문 한 건이 결제 대기 동안 재고를 15분 예약한다(spec.md:24, 55).
- 근거: 레이트 리미터는 일부 라우트에만 걸려 있다(`GatewayRouteConfig.kt:186-190` 등). 기본값도 사용자당 100/s 로 넉넉하다(`RateLimiterConfig.kt:41-42`).
- 위험: 계정 하나로 주문을 반복하면 인기 상품 재고를 계속 잠가 둘 수 있다.
- 수정안: 주문서·주문·클레임 라우트에 레이트 리밋을 건다. 사용자당 동시 `PAYMENT_PENDING` 주문 수에 상한을 두고(예: 3) 넘으면 409 로 거부한다. 쿠폰 정의에는 1인 발급 한도를 둔다.

### S8 [Medium] 판매자 PII 수집에 맞춰 개인정보처리방침·보존기간을 갱신해야 한다 — 체크: 민감 데이터 흐름(수집·삭제)
- 스펙: 대표자 실명, 사업자등록번호, 정산 계좌를 수집한다(spec.md:40).
- 근거:
  - 방침 §2 의 커머스 항목은 "주문 내역(데모 데이터)" 한 줄뿐이다(`PrivacyPage.tsx:111-115`).
  - 방침은 실명을 받지 않는다고 쓰고 있다(`PrivacyPage.tsx:124`, 소셜 로그인 문맥).
  - 루트 `CLAUDE.md` 원장 보존기간 규칙: 방침에 적은 숫자와 상수가 같아야 한다(ADR-0077).
- 수정안: SR-7 문서 목록에 다음을 넣는다.
  - `PrivacyPage` §2·§6 갱신 — 판매자 항목·목적, 보관기간(거래 기록은 전자상거래법 기간, REJECTED 신청은 파기 시점)
  - ADR-0077 보존 표에 판매자 행 추가
  - 파기 배치 여부 결정

### S9 [Low] PCI-DSS 범위 선언이 없다 — 체크: 결제 데이터 PCI-DSS
- 스펙 SR-1(spec.md:29-36)에 카드 데이터 경계가 없다.
- 수정안: 한 줄로 선언한다. 「카드 정보는 PG 결제창(토스 위젯)에서만 입력받고 서버·DB·로그·Kafka 에 카드번호·CVV·유효기간을 싣지 않는다. PG 응답의 마스킹 카드번호만 저장한다. 토스 시크릿 키는 테스트 키라도 Secret 으로 두고 레포에 쓰지 않는다」.

### S10 [Low] 권한·요율 변경의 감사 이력이 없다 — 체크: 감사 로깅
- 있는 것: 주문 상태 이력(주체·사유, spec.md:60), 운영 큐 처리 기록(spec.md:76), DLT 종결 사유(spec.md:75).
- 없는 것: 판매자 상태 전이(승인·반려·정지), 수수료율 변경 전/후 값, 역할 부여·회수, DLT 재발행의 주체. 수수료율은 정산 금액을 바꾸므로 부인 방지가 필요하다.
- 수정안: `seller_history`(이전·이후·필드·주체·시각)를 추가하고, auth 역할 변경 로그와 DLT 재발행 주체 기록을 SR-2·SR-6 에 적는다.

## 발견 보고 (태스크 범위 밖 — 진행 여부 확인 필요)

- 관리자 대시보드용 매출 집계 `GET /api/orders/stats/**`(`OrderStatsController.kt:11-21`)가 `userConfig()`(`GatewayRouteConfig.kt:139-147`) 아래에 있다. 로그인 회원 누구나 오늘 매출을 볼 수 있다. 마켓플레이스가 되면 판매자 매출 추정 경로가 된다. 이 스펙에 `stats` 라우트를 ADMIN 으로 좁히는 항목을 넣을지 확인이 필요하다.

## 체크리스트 판정

| 항목 | 판정 |
|---|---|
| 위협 모델링(STRIDE) | 부분 — 스펙에 없음, 위 표로 보완 제안 |
| 인증/인가 경계 | 미흡 — S1, S4, S6 |
| 민감 데이터 흐름 | 미흡 — S3, S8 |
| 입력 검증 바운더리 | 부분 — 가격 제거는 좋음(spec.md:23), S6-4 |
| 서비스 간 통신 보안 | 미흡 — S2, S5 |
| 시크릿/크리덴셜 | 미흡 — S2, S3, S9 |
| 암호화/해싱 | 부분 — 방식은 정했고 키 관리가 없음(S3) |
| 감사 로깅 | 부분 — S10 |
| PCI-DSS | 미선언 — S9 |
| 주문/재고 변경 권한 | 미흡 — S1 |
| Rate Limiting / Abuse | 미흡 — S7 |

VERDICT: REVISE (round 1)

---

## Round 2

- 대상: 개정된 `spec.md`(252줄) · `planning/test-quality.md` · `ADR-0099`
- 사용자 결정(재론하지 않음): 상품 쓰기 인가와 매출 통계 ADMIN 전용을 이번 범위에 넣는다.

### 1라운드 이슈 해소 여부

| # | 상태 | 근거 |
|---|---|---|
| S1 상품 쓰기 인가 | **해소 (조건부)** | spec.md:38, :168, test-quality.md:26. 단, 경로·`/bulk` 처리가 비어 있다 → R2-1 |
| S2 웹훅 키·노출 | 해소 | spec.md:114 (toss 일 때만 매핑, 재조회 결과로 전이, 운영 모의 PG 는 경로 없음), :169, :206, test-quality.md:43 |
| S3 계좌 키 관리 | **해소 (조건부)** | spec.md:121 (전용 Secret, 키 버전, 지급 경로만 복호화, 백업 대상), :206. 기본값 금지가 빠졌다 → R2-3 |
| S4 정지 즉시 차단 | 해소 | spec.md:123, ADR-0099:77, test-quality.md:47, 회귀 주입 대상(test-quality.md:74) |
| S5 auth 컨슈머 범위 | 해소 | spec.md:122 (ROLE_SELLER 한 역할), ADR-0099:77 (수용 위험 기록), test-quality.md:46 |
| S6 라우트 표·객체 인가 | **부분 해소** | 라우트 표·소유 검사·헤더 없으면 401 은 spec.md:162-170. 게이트웨이 라우팅 검사 행이 테스트에 없다 → R2-2. `Idempotency-Key` 형식 검증은 여전히 없다(Low, 비차단) |
| S7 재고 선점 남용 | 해소 | spec.md:107 (결제 대기 3건 초과 429, 주문서 레이트 리밋), test-quality.md:39 |
| S8 방침·보존기간 | 해소 (잔여 Low) | spec.md:208. REJECTED 신청자 PII 파기 시점은 여전히 정하지 않았다 — 비차단 |
| S9 PCI-DSS 선언 | 해소 | spec.md:116, 토스 키 Secret spec.md:206 |
| S10 감사 이력 | 해소 | spec.md:127, :156 |
| 범위 밖 보고(stats) | 해소 | spec.md:39, test-quality.md:27 |

### 새로 확인한 이슈

#### R2-1 [Medium] 상품 쓰기 경로 이름이 코드와 달라 인가가 엉뚱한 곳에 걸릴 수 있고, `/bulk` 호출자가 정해지지 않았다 — 체크: 인증/인가 경계
- 스펙: 상품 쓰기 인가 대상을 `/api/v1/products` 로 적었다(spec.md:168). 경로 이동은 주문만 적혀 있다(spec.md:58).
- 코드: 컨트롤러는 `/api/products` 다(`ProductController.kt:21`). 게이트웨이 `product-service-write` 도 `/api/products/**` 에 `userConfig()` 를 건다(`GatewayRouteConfig.kt:131-138`).
- 위험: 표대로 `/api/v1/products` 에 `sellerConfig()` 라우트만 새로 만들면, 실제로 호출되는 `/api/products/**` 는 ROLE_USER 로 그대로 열려 있다. 서비스 소유 검사만 남는데, 그 검사가 빠지면 1라운드 S1 이 그대로 재현된다.
- `/bulk`: search-batch 가 게이트웨이를 거치지 않고 `POST /api/products/bulk` 를 직접 부른다(`search/batch/.../ProductApiClient.kt:65-72`). 신원 헤더가 없다. spec.md:38 대로 구현하면 두 결과 중 하나가 된다.
  - 시드가 403 으로 깨진다.
  - 구현자가 「헤더 없으면 내부 호출로 보고 허용」을 넣는다. 이것이 fail-open 이다.
- 수정안: SR-1 표에 한 행을 추가한다. 「`/api/products/**` → `/api/v1/products/**`, 게이트웨이 라우트와 admin-fe·portal-fe 호출을 같은 단계에서 교체」. 경로를 유지하기로 하면 spec.md:168 을 `/api/products` 로 고친다. `/bulk` 는 게이트웨이 라우트가 없는 `/internal/products/bulk` 로 옮기고, 공개 컨트롤러에서는 뺀다고 SR-0 에 적는다. 서비스는 신원 헤더가 없는 쓰기를 401 로 거부한다.

#### R2-2 [Medium] 라우트 표를 검사하는 테스트가 없다 — 체크: 인증/인가 경계
- 스펙: spec.md:162-170 이 경로별 인증 수준을 정한다.
- 테스트: test-quality.md:22-70 의 인가 행은 전부 component(서비스·컨트롤러) 층이다. 게이트웨이 라우팅 행은 없다. component 테스트는 컨트롤러에 헤더를 직접 넣으므로 게이트웨이 라우트를 빠뜨리거나 넓은 `**` 가 앞을 가려도 초록불이 난다.
- 근거: 이 레포에서 라우트 순서 때문에 인증이 조용히 약해진 적이 있다(`gateway/CLAUDE.md` 「좁은 경로를 먼저 선언한다」, `GatewayRouteConfig.kt:281-282` · `:304` · `:331` 주석).
- 수정안: test-quality.md 에 SR-11 행을 추가한다. 「라우트 표의 각 경로: 무토큰 401 · 역할 부족 403(ROLE_USER 로 `/api/v1/seller/**`·상품 쓰기·`/api/v1/admin/**`) · 위조 `X-User-Id`/`X-User-Roles` 제거 · 웹훅은 `payment.pg=mock` 에서 404」. 층은 gateway 라우팅 스펙이다.

#### R2-3 [Low] 상품 생성의 `seller_id` 출처와 필수 키의 기본값 금지가 적혀 있지 않다 — 체크: 인가 경계 · 시크릿
- 상품 생성: 「판매자는 자기 상품만」(spec.md:168)은 수정에는 분명하지만, 생성 요청 본문에 `sellerId` 를 받으면 남의 판매자 이름으로 상품을 만들 수 있다. 수정안: 「판매자의 생성 요청은 `seller_id` 를 `X-User-Id` 의 ACTIVE 판매자 행에서 정한다. 본문 값은 어드민만 쓸 수 있다」를 spec.md:38 에 덧붙인다.
- 키 기본값: spec.md:121·:206 은 「키가 없으면」만 막는다. 이 레포는 공개 문자열 기본값을 둔 관례가 있다(1라운드 S2 근거 `SaveCipher.kt:42`). yml 에 `${SELLER_ACCOUNT_ENC_KEY:…}` 기본값이 들어가면 「없음」이 아니므로 기동한다. 수정안: 「설정 파일에 기본값을 두지 않는다」를 spec.md:206 에 한 줄 추가한다. `TOSS_WEBHOOK_SECRET` 도 같다.

### 체크리스트 판정 (Round 2)

| 항목 | 판정 |
|---|---|
| 인증/인가 경계 | 부분 — R2-1, R2-2 |
| 민감 데이터 흐름 | 충족 (REJECTED 파기 시점 잔여 Low) |
| 입력 검증 바운더리 | 충족 (Idempotency-Key 형식 잔여 Low) |
| 서비스 간 통신 보안 | 충족 — 수용 위험 기록됨 |
| 시크릿/크리덴셜 | 부분 — R2-3 |
| 암호화/해싱 | 충족 |
| 감사 로깅 | 충족 |
| PCI-DSS | 충족 |
| 주문/재고 변경 권한 | 부분 — R2-1 |
| Rate Limiting / Abuse | 충족 |

VERDICT: REVISE
