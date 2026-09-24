# Test Quality — commerce 엔터프라이즈화

스택: Kotest BehaviorSpec + MockK (`docs/standards/test-rules.md`). ★ = critical path.

## 층과 경계

| 층 | 무엇이 실물 | 무엇을 대체 | 위치·이름 |
|---|---|---|---|
| unit | 도메인 객체 | 없음 (Mock 금지) | `{svc}/domain/src/test` `{Class}Test.kt` |
| component | 서비스 + 컨트롤러 | Port 는 MockK, 컨트롤러는 UseCase MockK | `{svc}/feature/src/test` |
| integration | 한 도메인의 서비스 + 어댑터 + MySQL(Testcontainers) | 다른 도메인은 Kafka 레코드 직접 발행 | `{svc}/feature/src/test/.../*IntegrationTest.kt` |
| e2e | commerce:app 전체 + MySQL + Kafka(Testcontainers) | PG 만 모의 PG. **코디네이터·컨슈머·릴레이는 대체 금지** | `commerce/app/src/test/.../saga/*E2ETest.kt` |

- 모의 PG 시나리오는 테스트 전용 `MockPgScenario` 빈으로 주입한다(승인·거절·타임아웃→N번째 조회에서 승인·지연 웹훅). 운영 모의 PG 는 항상 승인.
- 시간은 `Clock` 빈 주입 — TTL · 백오프 · 보류 기한 · 구매 확정 · 정산 기간 테스트 전부.
- 비동기 판정은 Kotest `eventually(10s)` 로 DB 상태를 본다. 고정 sleep 금지.
- **Docker 가 없을 때 건너뛰지 않는다**: `CI=true` 이면 Testcontainers 부재가 실패다(기존 `CommerceContextLoadSpec` 의 조용한 skip 을 E2E 가 복사하지 않는다). 실행 건수를 CI 로그에 남긴다.
- 컨텍스트 로드는 빈 존재가 아니라 **도메인마다 행 하나를 쓰고 다시 읽는다**(TM 한정자 누락 검출).

## 시나리오

| SR | 시나리오 | 층 | 판정 근거 |
|---|---|---|---|
| SR-2 | 주문·결제·클레임·판매자·정산서·사가 전이표 전수 + 금지 전이 예외 | unit | 표의 모든 행 허용, 나머지 예외 |
| SR-0 ★ | 주문 요청 본문에 가격을 넣어도 무시·거부 | component | DTO 에 필드 없음 + 요청 JSON 의 price 가 합계에 영향 0 |
| SR-0 ★ | 상품 쓰기: 비판매자 403 · 남의 상품 403 · 본인 200 · 어드민 200 | component | 응답 코드 |
| SR-0 | 매출 통계: ROLE_USER 403 | component | 응답 코드 |
| SR-0 ★ | 2라인 중 1라인 부족 → 예약 0행, `reservation.failed` | integration | reservation 행 수 0 |
| SR-0 | 확정·만료·해제·입고 각각 `inventory.stock.*` 발행 | integration | 아웃박스 행 4종 |
| SR-10 ★ | 아웃박스 원문 JSON | integration | 수신 값 첫 글자 `{` |
| SR-10 ★ | 릴레이 두 개 동시 → 발행 1회, 리스 만료 재수집, 10회 실패 FAILED, 7일 정리 | integration | 수신 건수·행 상태 |
| SR-10 | partition_key = orderId 로 발행 | integration | 레코드 키 |
| SR-7 ★ | 안분: 잔차는 금액 최대 라인(동률 앞), 라인 합 = 할인 총액 | unit | 원 단위 값 |
| SR-7 | 정률 내림 · 수수료 HALF_UP · 쿠폰 최소 주문 금액·최대 할인·기간 경계 | unit | 경계값 |
| SR-4 | `order_saga` `@Version` 동시 이벤트 충돌 → 한쪽 재시도로 수렴 | integration | 사가 단계 |
| SR-7 | 쿠폰 발행 상한 동시 100요청 → 상한만큼 발행 | integration | 발행 수 |
| SR-7 | 포인트 잔액 음수 불가 · TCC 같은 orderId 두 번 = 한 번 | unit + integration | 잔액·행 수 |
| SR-4 ★ | Idempotency-Key: 처리 중 409, 완료 후 동일 응답, 리스 만료 뒤 재시도 허용 | component | 응답 바디 동일·주문 1건 |
| SR-4 | 만료·재사용·타인 주문서 → 422 | component | 응답 코드 |
| SR-4 | 결제 대기 4번째 주문 429 | component | 응답 코드 |
| SR-5 ★ | UNKNOWN → 재조회 → AUTHORIZED 수렴 | integration | payment 상태 |
| SR-5 ★ | 같은 orderNo 재요청 → PG 승인 1건 | integration | 모의 PG 호출 기록 |
| SR-5 | 토스 어댑터 승인 확인·조회·취소 (MockWebServer) | integration | 요청 본문·헤더 |
| SR-5 ★ | 기본 프로필(모의 PG): 토스 빈 없음, 웹훅 경로 404 | integration | 빈 부재·응답 |
| SR-5 | 재조회 5회 초과 → 운영 이슈 | integration | ops_issue 행 |
| SR-5 | 토스 웹훅 서명 실패 401 · 중복 no-op · 본문 금액 무시하고 재조회 결과 사용 | component | 응답·상태 |
| SR-5 | 환불 합 > 매입액 거부 | unit | 예외 |
| SR-6 ★ | 판매자 신청 → 승인 → `seller.seller.approved` 발행 | integration (commerce) | 아웃박스 행 |
| SR-6 ★ | auth 컨슈머: approved → ROLE_SELLER 행, suspended → 회수, 다른 역할 요청 무시 | integration (auth) | member_roles 행 |
| SR-6 | 정지된 판매자 API 403 (토큰 유효해도) · 정지 판매자 상품 주문서 422 | component | 응답 코드 |
| SR-6 | 계좌 암호화 저장·마스킹, 키 없으면 기동 실패 | integration | 컬럼 값·기동 예외 |
| SR-6 | SUSPENDED 회원 재신청 거부 · 판매자 상품의 seller_id 는 본문 무시 | component | 응답·행 |
| SR-7 | 수수료율 스냅샷 — 요율 변경 후에도 기존 라인 요율 유지 | integration | 라인 값 |
| SR-2 | 주문 `@Version` 충돌 · 모든 전이에 status_history 행 | integration | 예외·행 수 |
| SR-11 ★ | 게이트웨이: SR-11 표의 경로마다 무토큰 401 · 역할 부족 403 · 위조 X-User-Id 제거 · `/internal/**` 라우트 없음 | integration (gateway) | 응답 코드 |
| SR-4 ★ | E2E 정상: 주문 → CONFIRMED → 이행 생성 | e2e | 사가 COMPLETED, 예약 CONFIRMED, 결제 CAPTURED |
| SR-4 ★ | E2E 결제 거절: 혜택 원복·재고 해제·FAILED | e2e | 행 상태 |
| SR-4 ★ | E2E 재고 부족: 결제 호출 0회, FAILED | e2e | 모의 PG 기록 0 |
| SR-4 ★ | E2E 결제 UNKNOWN → 사가 대기(주문 취소 없음) → 조회 승인 → CONFIRMED | e2e | 대기 중 주문 상태 PAYMENT_PENDING 유지 |
| SR-4 ★ | E2E 보류 만료 (a) 결제 AUTHORIZED 뒤 만료 도착 → VOID → PAID→FAILED, 확정분 restock·restore | e2e | 결제 VOIDED·재고 원복 |
| SR-4 ★ | E2E 보류 만료 (b) 결제 UNKNOWN 중 만료 → VOID 예약(만료 직후 VOID 호출 0회) → 조회 결과 AUTHORIZED 시 VOID 실행 → FAILED / 조회 결과 거절이면 VOID 0회 → FAILED | e2e | 결제 VOIDED 또는 FAILED, 승인된 채 남지 않음 |
| SR-4 | 만료된 예약에 confirm 명령 → `reservation.failed(EXPIRED)`, DLT 0건 | integration | 이벤트·DLT |
| SR-2 ★ | PAYMENT_PENDING 중 구매자 취소 409, 보상 미실행 | component + e2e | 응답·예약 유지 |
| SR-4 | 결제 UNKNOWN 결론 FAILED → 보상 실행 | e2e | 재고 해제·혜택 원복 |
| SR-4 | E2E 피벗 뒤 실패 → 재시도 수렴 / 10회 초과 STUCK + 운영 이슈 | e2e | 사가 상태 |
| SR-4 | E2E 0원 주문 → 결제 없이 CONFIRMED | e2e | 결제 행 0 |
| SR-4 | E2E 중복 요청(같은 키) → 주문 1건 | e2e | 행 수 |
| SR-1 | 은퇴한 리스너가 없다 — 옛 토픽 레코드를 넣어도 예약·이행이 생기지 않는다 | e2e | 행 수 0 |
| SR-8 ★ | E2E 부분 취소 → 포인트 원복 + 부분 환불 → 결제 PARTIALLY_REFUNDED, 라인 CANCELLED, 주문 `refunded_amount` 증가 | e2e | 금액·상태 |
| SR-8 | 부분 취소 후 쿠폰 할인 유지 · 전체 취소 쿠폰 반환 · 배송비 규칙 | unit | 환불액 |
| SR-8 | 클레임 분기: 이행 없음·cancelled → 자동 승인, cancel-rejected → 판매자 승인 대기 | integration | 클레임 상태 |
| SR-8 | 부분 취소 주문도 남은 라인 구매 확정 → COMPLETED | e2e | 주문 상태 |
| SR-8 | 구매 확정 자동(시계 주입) → `order.line.purchase-confirmed` | integration | 이벤트 |
| SR-9 ★ | 원장 거래 차·대 합 ≠ 0 생성 예외, 역분개 · 분개 규칙 표 네 시점 각각 차 = 대 | unit | 예외·금액 |
| SR-9 | 배송비 라인은 판매자 마지막 라인 확정 시점 정산서에 포함, 전 라인 취소 시 제외 | unit | 정산서 |
| SR-9 ★ | 원장 이벤트 id 멱등 (같은 이벤트 두 번 = 거래 1건) | integration | 행 수 |
| SR-9 ★ | 정산: 지급액 = Σ라인 순매출 + Σ배송비 − Σ수수료 = 미지급금 감소분, 환불 라인은 정산서에 없음 | unit + e2e | 원 단위 일치 |
| SR-9 | 지급액 ≤ 0 → CARRIED_OVER | unit | 상태 |
| SR-5 | PG 대사 불일치 → 운영 이슈 1행, 일치 → settled 이벤트 | integration | 행·이벤트 |
| SR-10 | DLT 레코드 → 운영 이슈 적재 → 재발행 API | integration | 원 토픽 재수신 |
| SR-10 | traceparent 가 아웃박스를 거쳐 컨슈머 MDC 에 | integration | traceId 동일 |
| SR-14 | 컨텍스트 로드: 새 4도메인 행 쓰기·읽기 | integration | 값 |
| SR-13 | 상태 전환 마이그레이션: COMPLETED→CONFIRMED, PENDING→FAILED, 금액 백필 | integration | 행 값 |
| SR-13 | ACTIVE 예약 전환 작업: CONFIRMED + reserved_qty 차감 + stock.confirmed, 두 번 실행해도 한 번 | integration | 수량·이벤트 수 |
| FE | 주문서·결제 대기·클레임·판매자 포털·어드민 화면 | e2e (CDP) | 라이트/다크 × 모바일/데스크톱 캡처 (`fe-visual-verification.md`) |

## 회귀 주입

원장 불변식 · 멱등 키 · 아웃박스 직렬화 · 보류 만료 VOID (b) 분기 · 부분 예약 원자성 · 판매자 정지 즉시 차단 · 게이트웨이 인증 수준 일곱 검사는
구현을 임시 사본에서 일부러 깨 빨간불을 본 뒤에 켰다고 `verifications/` 에 기록한다.
