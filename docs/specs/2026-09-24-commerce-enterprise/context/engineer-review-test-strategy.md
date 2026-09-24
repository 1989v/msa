# Engineer Review — test-strategy

- 대상: `spec.md`, `planning/test-quality.md`, `planning/requirements.md`, `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 기준: `docs/standards/test-rules.md`, `commerce/CLAUDE.md`, `scripts/ci/topology.sh`, `.github/workflows/{ci,images}.yml`, 볼트 [[gate-failure-modes]] · [[modular-monolith-fold]]
- `tasks.md` 는 아직 없다. 그래서 AC → 테스트 매핑은 `test-quality.md` 표를 기준으로 했다.

## 요약

test-quality.md 는 층 배정(도메인 불변식은 unit, 멱등·직렬화는 integration, 사가는 e2e)과 회귀 주입 규율(`test-quality.md:32`)이 좋다.
다만 스펙의 **⚑ 결함 두 개가 테스트 행을 갖지 않고**, 안분 잔차 규칙은 스펙과 테스트 표가 **서로 다르다**.
CI 가 새 도메인 테스트를 실제로 돌리는지도 정하지 않았다. 모두 표에 행을 더하거나 문구를 고치면 해결되므로 BLOCK 이 아니라 REVISE 로 판정한다.

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 도출 | 부분 — 아래 T1·T2·T4 |
| 2 | 층 배정 적절 | 대체로 적절 — T5 |
| 3 | mock 경계 명확 | 부분 — T6 |
| 4 | 테스트 데이터 전략 | 미정 — T7 |
| 5 | 부정·경계 케이스 | 부분 — T4 |
| 6 | 네이밍 컨벤션 | 미정 — T8 |

## Findings

### T1 (체크 1·5) ⚑ 결함 두 개에 테스트가 없다 — 우선순위 높음

- **R0.2 가격 위변조**: 스펙 `spec.md:23` 은 「클라이언트가 보낸 가격 필드는 API 에서 사라진다」고 정했다. ADR-0099:19 는 이 결함을 가격 위변조로 적었다. 그런데 `test-quality.md` 에는 이것을 확인하는 행이 없다.
  - 수정안: component 행을 하나 추가한다. `unitPrice` 나 `totalAmount` 를 붙인 요청을 보내도 주문 라인 금액이 주문서 스냅샷과 같은지를 **저장된 값**으로 판정한다.
- **R0.4 결제 결과 미상 = 실패 아님 (사가 층)**: 스펙 `spec.md:59` 는 「UNKNOWN 은 사가를 대기로 둔다 … 주문을 먼저 취소하지 않는다」고 정했다. `requirements.md:85` 도 「결제 타임아웃→UNKNOWN→조회 성공」을 **사가 E2E** 로 적었다. 그런데 `test-quality.md:13` 은 이것을 payment 행 수렴만 보는 integration 으로 낮췄다. 그래서 사가가 그 사이에 보상하지 않는다는 것을 아무 테스트도 보지 않는다.
  - 수정안: e2e ★ 행을 추가한다. 모의 PG 타임아웃을 주입한 뒤 다음 네 가지를 판정한다.
    - 사가 타임아웃이 지나도 주문이 FAILED 나 CANCELLED 가 아니다.
    - 재고 예약이 해제되지 않았다.
    - 재조회가 AUTHORIZED 로 결론 나면 사가가 COMPLETED 가 된다.
    - 결론이 FAILED 면 보상이 한 번만 일어난다.

### T2 (체크 1) 스펙과 테스트 표의 안분 잔차 규칙이 서로 다르다

- `spec.md:50`: 「안분 잔차(원 단위)는 **금액이 가장 큰 라인**에 붙고」
- `test-quality.md:10`: 「원 단위 잔차가 **마지막 라인**에 붙고 합계 보존」
- 이대로 구현하면 테스트가 스펙과 다른 규칙을 고정한다. 부분 환불 금액(`spec.md:66`)과 정산 상계 금액도 따라서 달라진다.
- 수정안: test-quality 판정 근거를 「가장 큰 라인」으로 고친다. 금액이 같은 라인이 여럿일 때 어느 라인을 고르는지도 함께 명시하고(예: 라인 순번이 가장 작은 것), 그 경우를 케이스로 넣는다.

### T3 (체크 1) requirements 의 E2E 목록과 test-quality 가 어긋난다

- `requirements.md:85` 는 E2E 로 7개를 적었다: 정상 · 결제 거절 · 타임아웃→UNKNOWN→조회 성공 · 재고 부족 · 중복 요청 · 부분 환불 · 정산 1회.
- test-quality 는 그중 「UNKNOWN」을 integration 으로 내렸다(T1). 「중복 요청」은 component 로 옮겼다(`test-quality.md:16`, 이 층 선택은 타당하다). 「정산 1회」는 부분 취소 행(`test-quality.md:24`)에 합쳤다.
- 수정안: 층을 옮긴 이유를 test-quality 에 한 줄로 적는다. 또는 requirements 목록을 test-quality 에 맞춘다. 원본이 두 곳이면 구현자가 어느 쪽을 따를지 모른다.

### T4 (체크 1·5) 테스트 행이 없는 요구와 경계 케이스

아래 SR 은 test-quality 에 대응 행이 없다. 우선순위 순으로 적었다.

| 스펙 | 요구 | 제안 층 · 판정 근거 |
|---|---|---|
| `spec.md:25` | 한 주문의 예약은 전부 성공 또는 전부 실패. 부족분은 DLT 가 아니라 `inventory.reservation.failed` 로 돌아온다 | integration ★ — 2라인 중 1라인만 부족하면 예약 행 0, DLT 0건, 실패 이벤트 1건. `test-quality.md:21` 은 결제 호출 0회만 보고 **부분 예약 잔존**은 보지 않는다 |
| `spec.md:69` | 원장 기록은 이벤트 id 로 멱등 | integration ★ — 같은 매입 이벤트를 두 번 넣어도 journal 1건 |
| `spec.md:33` · `spec.md:58` | 재조회 5회 초과, 피벗 뒤 재시도 한도 초과 → 운영 큐 | integration — 한도 +1 에서 운영 큐 1행, 한도에서는 0행(경계 양쪽) |
| `spec.md:26` | 예약 확정·만료·해제가 모두 product 재고 동기화 이벤트를 낸다 | integration — 세 경로 각각 이벤트 1건 |
| `spec.md:43` | 수수료율은 주문 시점 스냅샷이라 이후 요율 변경이 과거 주문에 영향이 없다 | unit — 요율을 바꾼 뒤 정산 금액이 그대로 |
| `spec.md:42` | 판매자는 자기 상품만 수정한다(403) | component — 다른 판매자 상품을 수정하면 403. `test-quality.md:27` 은 「승인 전 403」만 본다 |
| `spec.md:41` | 정지하면 역할을 회수한다 | integration — 정지 이벤트 후 `member_roles` 행이 없다 |
| `spec.md:48` · `spec.md:52` | 주문서 15분 만료, 쿠폰·포인트 예약도 같이 풀림 | integration — 만료된 주문서로 주문하면 거부, 쿠폰 reserve 가 cancel 됨 (시계 주입) |
| `spec.md:51` | 쿠폰 최소 주문 금액·최대 할인·기간·발행 수 | unit — 각 경계 ±1원, 발행 수 소진 |
| `spec.md:35` | 환불 합은 매입액을 넘지 못한다 | unit — 누적 부분 환불이 초과하면 예외 |
| `spec.md:65` | 출고 전 취소는 자동 승인, 출고 후는 판매자 승인 | unit/integration — 두 분기 |
| `spec.md:75` | DLT 조회·재발행·종결 어드민 API | component — 재발행하면 원 토픽으로 1건, 종결 사유가 저장됨 |
| `spec.md:62` | 사가 이벤트·명령의 파티션 키는 모두 orderId | integration — 발행 레코드 key == orderId (명령 4종 + 결과 이벤트) |
| `spec.md:60` | `@Version` 과 전이마다 `order_status_history` | integration — 동시 전이 하나는 낙관적 락 실패, 이력 행 수 == 전이 수 |
| `spec.md:31`, Out of Scope `spec.md:105` | 토스 어댑터 MockWebServer 테스트, `payment.pg=toss` 일 때만 빈 등록 | integration — 기본 프로필에서는 토스 빈이 없다, MockWebServer 로 승인·5xx→UNKNOWN |
| `spec.md:20` | `PRODUCT_SERVICE_URL`·`PAYMENT_SERVICE_URL` 의존 제거, 상품 스냅샷 읽기 모델 갱신 | integration — product 이벤트 후 스냅샷 반영. 의존 제거는 테스트가 아니라 grep 게이트로 둬도 된다 |
| `spec.md:71` | 대사에서 금액이 다른 건 | integration — `test-quality.md:26` 은 「한쪽에만 있는 건」만 본다. 금액 불일치 1건을 추가 |

### T5 (체크 2) 판매자 → ROLE_SELLER 행은 한 integration 으로 성립하지 않는다

- `test-quality.md:27` 은 「신청 → 승인 → ROLE_SELLER → 상품 등록」을 integration 하나로 잡았다. 그런데 auth 는 commerce 와 **다른 파드**다(`scripts/ci/topology.sh:12`, `topology_pod_for_path` 의 `auth/*`). 그래서 commerce:app 의 Testcontainers 컨텍스트에는 auth 컨슈머가 없다.
- 수정안: 세 개로 나눈다.
  - commerce 쪽: 승인하면 `seller.seller.approved` 가 아웃박스로 1건 나간다.
  - auth 쪽: `:auth:app:test` 에서 이벤트를 받으면 `member_roles` 행이 추가된다.
  - 403/201: 역할 클레임을 가진 요청으로 component 에서 판정한다.
- 이 경계의 토큰 갱신 시점은 usecase 차원이라 여기서는 다루지 않는다.

### T6 (체크 3) mock 경계를 층별로 명시해야 한다

- `test-rules.md:11-12` 는 두 가지를 정한다: Domain 은 mock 금지, Application 은 Outbound Port 만 MockK.
- test-quality 는 스택만 적었다(`test-quality.md:3`). **e2e/integration 에서 무엇이 실물인지**는 적지 않았다.
- 수정안: 표 머리에 한 단락을 둔다. 제안은 다음과 같다.
  - e2e: MySQL·Kafka 는 Testcontainers 실물을 쓴다. PG 는 `PgPort` 모의 구현(실제 빈)을 쓰고 MockK 를 쓰지 않는다. 코디네이터와 다른 도메인 빈은 mock 하지 않는다(ADR-0099:39 의 Kafka 경계를 테스트가 우회하면 안 된다).
  - integration: 외부 HTTP(토스)만 MockWebServer 로 대체한다.
  - 사가 코디네이터의 application 테스트: 아웃박스 포트와 저장소 포트만 MockK 로 둔다.

### T7 (체크 4) 테스트 데이터와 시간·장애 주입 방식이 정해지지 않았다

- 스펙 `spec.md:31` 은 모의 PG 가 승인·거절·타임아웃·지연 웹훅·정산 파일을 「결정적으로 주입」한다고만 적었다. **무엇으로 고르는지**(금액 끝자리, 카드번호 매직값, 테스트 전용 스크립트 큐 등)는 정하지 않았다. E2E 네 행(`test-quality.md:19-22`)이 전부 이 방식에 기댄다.
- 시계 주입은 구매 확정 행에만 있다(`test-quality.md:25`). 예약 TTL(`spec.md:24`), 주문서 만료(`spec.md:48`), 재조회 지수 백오프(`spec.md:33`), 사가 타임아웃(`spec.md:56`), 정산 주기 마감(`spec.md:70`)도 모두 시간에 의존한다.
- 수정안: 다음 세 가지를 정한다.
  - 모의 PG 시나리오 선택 규칙을 스펙이나 test-quality 에 명시한다.
  - 도메인 전반에 `Clock` 빈을 주입한다고 명시한다.
  - 주문서·판매자·쿠폰 픽스처 빌더의 위치를 정한다. 여러 도메인이 공유하므로 `commerce/app/src/test` 아래나 `java-test-fixtures` 를 쓴다.
- 비동기 판정 방식도 정한다(예: Kotest `eventually` + 상한 시간). E2E 가 플레이크를 내면 commerce 이미지 전체가 막힌다(ADR-0099:70, 볼트 [[gate-failure-modes]] ⑨ 「플레이크 하나로 전 서비스 이미지 미생성」).

### T8 (체크 6) 테스트 이름과 위치 규칙이 없고, CI 가 실제로 돌리는지 확인하는 장치가 없다

- 네이밍: `test-rules.md:17` 은 `구현체 이름 + Test` 를 정한다. Testcontainers 테스트는 레포에서 `*IntegrationSpec`·`*ContextLoadSpec` 을 쓴다(`commerce/app/src/test/kotlin/com/kgd/inventory/infrastructure/config/CommerceDualDataSourceIntegrationSpec.kt`, `CommerceContextLoadSpec.kt`). test-quality 에는 사가 E2E 의 클래스 이름과 모듈 위치가 없다. 여러 도메인에 걸치므로 `:commerce:app` 밖에 둘 곳이 없다.
  - 수정안: `CommerceSagaE2ESpec` 식으로 이름을 정하고 위치를 `commerce/app/src/test` 로 명시한다.
- 조용한 skip: 기존 Testcontainers 스펙은 Docker 가 없으면 `@EnabledIf` 로 **건너뛰고 초록**이다(`CommerceContextLoadSpec.kt:26-27`, `:49-52`). ★ E2E 가 같은 패턴을 복사하면, 로컬에서 「통과」가 사실은 0회 실행일 수 있다(볼트 [[gate-failure-modes]] ⑥).
  - 수정안: CI 환경(`CI=true`)에서는 Docker 가 없으면 skip 하지 말고 실패하게 한다. 회귀 주입 기록(`test-quality.md:32`)에 실행 건수도 함께 남긴다.
- CI 태스크 목록: 새 4도메인의 `:domain:test`·`:feature:test` 가 게이트에 들어가야 한다.
  - `images.yml` 은 생성물 `scripts/ci/topology.sh:28` 을 쓴다. 이 파일은 `scanBasePackages` 에서 만들어지므로 자동으로 따라온다.
  - PR 게이트 `.github/workflows/ci.yml:198` 은 **손으로 쓴 목록**이다. 지금도 product·deal 이 빠져 있다. 여기에 payment·seller·promotion·settlement 를 넣지 않으면 PR 단계에서 한 번도 안 돈다(볼트 [[modular-monolith-fold]] 「검사가 CI 에서 실제로 도는지까지 본다」).
  - 수정안: test-quality 에 「CI 태스크 목록 포함 확인」 행을 추가한다. ci.yml 의 commerce 분기를 `topology_test_tasks` 로 바꾸는 것은 이 스펙 범위 밖 개선이므로 **보고만** 한다.
- 컨텍스트 로드 행(`test-quality.md:29`)도 보강한다. 컨트롤러 빈 존재만 보지 말고, 새 도메인마다 **자기 TM 으로 한 행을 써서 값이 바뀌는지** 한 줄씩 둔다. 기존 deal 검사(`CommerceContextLoadSpec.kt:106-133`)와 같은 방식이다. 볼트 [[modular-monolith-fold]] 「값으로 판정하는 쓰기 테스트」에 따르면, 한정자 누락은 조회 테스트로는 안 잡힌다.

## 잘 된 점

- 원장 불변식·안분·정산 금액을 unit ★ 로 둔 층 배정이 맞다(`test-quality.md:9-11`).
- 아웃박스 원문 JSON 을 「첫 글자 `{`」라는 **산출물 값**으로 판정한다(`test-quality.md:17`, `spec.md:22`).
- 네 검사에 회귀 주입을 명시했다(`test-quality.md:32`). 볼트 [[gate-failure-modes]] 「그래서 무엇을 하나」 1번과 일치한다.

VERDICT: REVISE

---

## Round 2

- 대상: 개정된 `spec.md`(252줄), `planning/test-quality.md`(76줄), `planning/requirements.md:108`, ADR-0099
- 아래 줄 번호는 모두 **개정본** 기준이다. Round 1 의 줄 번호는 개정 전 파일 기준이다.

### Round 1 이슈 해소 여부

| # | 판정 | 근거 (개정본) |
|---|---|---|
| T1 가격 위변조 | 해소 | `test-quality.md:25` — DTO 에 필드가 없고, 요청 JSON 의 price 가 합계에 주는 영향이 0 이다 |
| T1 UNKNOWN 사가 대기 | 해소 (일부 남음 → R2-4) | `test-quality.md:52` — 대기 중 PAYMENT_PENDING 이 유지되는지 보는 e2e ★. 「결론 FAILED → 보상 1회」 분기는 행이 없다 |
| T2 안분 잔차 | 해소 | `spec.md:136` 과 `test-quality.md:33` 이 같다. 「금액 최대 라인, 동률이면 앞 라인」 |
| T3 E2E 목록 원본 둘 | 해소 | `requirements.md:108` — 정본은 test-quality 라고 적었다 |
| T4 부분 예약 원자성 | 해소 | `test-quality.md:28`, 회귀 주입 대상에도 들어갔다(`:74`) |
| T4 원장 이벤트 멱등 | 해소 | `test-quality.md:62` |
| T4 재시도 한도 경계 | 일부 | 사가 10회 STUCK 은 `:54` 에 있다. 결제 재조회 5회 초과 → 운영 이슈(`spec.md:113`)는 행이 없다 → R2-4 |
| T4 stock 동기화 이벤트 | 해소 | `test-quality.md:29` |
| T4 수수료율 스냅샷 | 미해소 → R2-4 | 행 없음 (`spec.md:137` 라인 스냅샷에 수수료율 포함) |
| T4 남의 상품 403 | 해소 | `test-quality.md:26` |
| T4 정지 → 역할 회수 | 해소 | `test-quality.md:46` |
| T4 주문서 만료 | 해소 | `test-quality.md:38`. 개정 스펙에서 주문서가 견적이 되어(`spec.md:93`) 예약 해제 검사는 더 필요 없다 |
| T4 쿠폰 경계 | 일부 | `:34` 가 정률 내림만 본다. 최소 주문 금액·최대 할인·기간 경계는 R2-4 |
| T4 환불 합 ≤ 매입액 | 해소 | `test-quality.md:44` |
| T4 클레임 자동/판매자 승인 | 미해소 → R2-4 | `spec.md:81` 의 분기에 행이 없다. `:24` 전이표는 승인 주체를 보지 않는다 |
| T4 DLT 재발행 | 해소 | `test-quality.md:66` |
| T4 partition key | 해소 | `test-quality.md:32` |
| T4 `@Version` · 상태 이력 | 미해소 → R2-4 | `spec.md:89` 에 대응하는 행이 없다 |
| T4 토스 빈 조건부 | 일부 → R2-3 | MockWebServer 는 `:42` 에 있다. 기본 프로필에서 빈과 웹훅 경로가 **없다**는 것을 보는 행은 없다 |
| T4 WebClient 의존 제거 | 미해소 (낮음) | grep 게이트로 둬도 된다. 차단 사유가 아니다 |
| T4 대사 금액 불일치 | 해소 | `test-quality.md:65` 「불일치」로 넓혔다 |
| T5 auth 경계 분리 | 해소 | `test-quality.md:45`(commerce 아웃박스) · `:46`(auth integration) · `:47`(component) |
| T6 mock 경계 | 해소 | `test-quality.md:7-12` 층별 실물/대체 표. e2e 는 코디네이터·컨슈머·릴레이를 대체하지 않는다 |
| T7 모의 PG 선택 규칙 | 해소 | `test-quality.md:14` `MockPgScenario` 빈 |
| T7 Clock · 비동기 판정 | 해소 | `test-quality.md:15-16` |
| T7 픽스처 빌더 위치 | 미해소 (낮음) | 구현자가 정해도 잘못된 구현으로 이어지지 않는다 |
| T8 이름·위치 | 해소 | `test-quality.md:9-12`. `*IntegrationTest` 는 레포 선례와 맞다(`inventory/feature/src/test/.../InventoryServiceIntegrationTest.kt`) |
| T8 조용한 skip | 해소 | `test-quality.md:17` — `CI=true` 이면 Docker 가 없을 때 실패한다. 실행 건수도 로그에 남긴다 |
| T8 CI 목록 | 해소 | `spec.md:209` SR-14, Out of Scope `:246` |
| T8 컨텍스트 로드 쓰기 검사 | 해소 | `test-quality.md:18` · `:68` |

### 새 이슈 · 남은 이슈

#### R2-1 (체크 1·5) 보류 만료 행이 VOID 의 두 분기를 하나로 뭉쳤다 — ★, 우선순위 높음

- `spec.md:104` 는 보류 만료가 먼저 왔을 때 두 경로를 정했다.
  - 결제가 **AUTHORIZED** 이면 즉시 VOID 한 뒤 FAILED 로 둔다.
  - 결제 결과를 **아직 모르면** VOID 를 예약해 두고, 결론이 나면 실행한다.
- `test-quality.md:53` 은 「VOID → FAILED」 한 행에 판정 근거 「결제 VOIDED·예약 RELEASED」만 두었다.
- 문제는 둘째 경로다. 예약해 둔 VOID 가 결론 시점에 실행되지 않으면 이렇게 된다.
  - 주문은 FAILED 다.
  - 재고는 풀려 다시 팔린다.
  - 결제만 AUTHORIZED 로 남는다.
  - 즉 돈은 잡히고 물건은 없다.
- 첫째 경로만 구현해도 이 행은 초록불이 난다. 회귀 주입 목록 `:74` 의 「보류 만료 VOID」도 어느 분기인지 정하지 않았다.
- 수정안: e2e ★ 두 행으로 나눈다. 둘째 행에는 결론이 FAILED 인 경우도 같이 넣는다.

| 시나리오 | 주입 | 판정 |
|---|---|---|
| (a) AUTHORIZED 뒤 보류 만료 | 승인 직후, 확정 명령 전에 `inventory.reservation.expired` 를 넣는다 | 결제 VOIDED, 주문 FAILED, 예약 RELEASED |
| (b) UNKNOWN 중 보류 만료 → 나중에 승인 | `MockPgScenario` 타임아웃, N번째 조회에서 승인 + 시계를 30분 넘긴다 | 만료 직후 결제는 UNKNOWN 이고 VOID 호출은 0회. 조회로 승인된 뒤 모의 PG VOID 호출 1회, 결제 VOIDED, 주문 FAILED. N번째 조회가 거절이면 VOID 호출 0회 |

- 회귀 주입 대상도 (b) 로 적는다.

#### R2-2 (체크 5) PAYMENT_PENDING 중 구매자 취소 409 에 행이 없다

- `spec.md:77` 은 이렇게 정했다: 「PAYMENT_PENDING 중 구매자 취소는 받지 않는다(409)」.
- 이 규칙은 UNKNOWN 대기 불변식(`spec.md:105`)을 **API 쪽에서** 지키는 장치다.
- 이 경로를 열어 두면 구매자 취소가 보상을 태운다. 그러면 재고와 혜택이 풀린 뒤에 결제가 승인될 수 있다.
- `test-quality.md:24` 전이표 unit 은 도메인 가드만 본다. 컨트롤러와 서비스가 이 요청을 CLAIM 경로로 돌리는지는 보지 않는다.
- 수정안: component 행을 하나 둔다. PAYMENT_PENDING 주문에 취소를 요청하면 409 가 나고, 보상 명령 아웃박스 행은 0 이다.

#### R2-3 (체크 5) 기본 프로필에서 웹훅 경로가 닫혀 있는지 보는 행이 없다

- `spec.md:114` 와 `:169` 는 이렇게 정했다: 「운영(모의 PG)에는 웹훅 경로가 열리지 않는다」.
- 이 경로는 공개(서명) 경로다. 조건부 매핑이 빠지면, 운영에서 서명키 없이 공개 엔드포인트가 뜬다.
- 키가 없으면 기동이 실패한다는 규칙(`spec.md:206`)은 `payment.pg=toss` 일 때만 적용된다. 그래서 모의 PG 기본값에서는 이 누락을 아무것도 잡지 않는다.
- `test-quality.md:43` 은 토스 프로필 안의 서명 검증만 본다.
- 수정안: component 또는 컨텍스트 로드 행을 하나 둔다. 기본 프로필에서 다음 둘을 확인한다.
  - `POST /api/v1/payments/webhooks/toss` 가 404 다.
  - 토스 `PgPort` 빈이 없다.

#### R2-4 (체크 1·5) 남은 작은 행들 — 비차단, 표에 한 줄씩

| 스펙 | 제안 층 · 판정 |
|---|---|
| `spec.md:113` 결제 재조회 5회 초과 → 운영 이슈 | integration — 5회째에는 0행, 6회째에는 1행 |
| `spec.md:105` UNKNOWN 결론이 FAILED | `:52` 에 이어서 판정한다. 보상(혜택 원복·재고 해제)이 1회씩 일어나고 주문은 FAILED |
| `spec.md:137` 라인 수수료율 스냅샷 | unit — 판매자 요율을 바꾼 뒤에도 기존 라인의 수수료가 그대로다 |
| `spec.md:130` 쿠폰 최소 주문 금액·최대 할인·기간 | unit — 각 경계 ±1원 |
| `spec.md:81` 출고 전 자동 승인 · 출고 후 판매자 승인 | unit — 두 분기 |
| `spec.md:89`·`:100` 주문 `@Version`·`order_status_history`, `order_saga @Version` | integration — 동시 전이 둘 중 하나는 실패한다, 이력 행 수 == 전이 수 |
| `spec.md:200` 진행 중 옛 사가의 예약 → CONFIRMED 전환 | `:69` 마이그레이션 행에 한 줄 더 |

### 판정

- 사람이 판단해야 할 것은 없다. 전부 test-quality 표에 행을 더하면 끝난다.
- 그중 **R2-1(b)** 는 결제가 된 주문에서 물건이 없어지는 경로다. 이 행 없이 구현하면 첫째 분기만으로 초록불이 난다. 그래서 SHIP 이 아니라 REVISE 다.
- R2-2·R2-3 은 결함 하나가 운영 사고로 바로 이어지는 행이라 함께 넣기를 권한다. R2-4 는 tasks 단계에서 넣어도 된다.

VERDICT: REVISE
