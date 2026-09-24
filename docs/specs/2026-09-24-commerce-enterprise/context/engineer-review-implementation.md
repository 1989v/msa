# Engineer Review — Implementation

- 대상: `docs/specs/2026-09-24-commerce-enterprise/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`)
- 차원: implementation (체크리스트 `hns/0.15.1/skills/spec-review/reviewers/implementation/checklist.md`)
- 일자: 2026-09-24
- KB: `HNS_KB_PATH`(1989v 볼트) 조회 — 사가·아웃박스·TCC·원장 키워드는 개념 페이지가 없었다. 적용한 표준은 [[modular-monolith-fold]] (vault, updated 2026-09-11) 하나다.
  kb-search.sh 는 Bash 가 없어 돌리지 못했고, 볼트를 직접 Grep 했다.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 요약 |
|---|---|---|---|
| 1 | 참조 클래스·모듈 존재 | PASS | `OutboxPollingPublisher`·`IdempotentEventHandler`·`OrderTransactionalService`·`PaymentAdapter`·`WebClientConfig`·`CommerceContextLoadSpec`·`Role.ROLE_SELLER`·`admin/frontend`·`portal-fe` Shop 화면이 전부 있다 |
| 2 | 기존 코드와 충돌 없음 | **FAIL** | 코레오그래피 리스너가 남아서 생기는 문제(F1), 아웃박스 키가 orderId 가 아닌 문제(F3), 도메인 간 데이터 접근(F4) |
| 3 | 복잡도 리스크 식별 | PARTIAL | auth 에 Kafka 가 없음(F7), 사가 토픽 목록 누락(F10), 운영 큐의 소유 도메인이 없음(F11) |
| 4 | NFR 안티패턴 | PARTIAL | 타임아웃은 SR-0 에서 다룸. 스케줄러 스레드가 1개(F9), 릴레이 비동기 마킹(F3) |
| 5 | 마이그레이션·롤백 | **FAIL** | 롤백 절이 없음. enum·금액 타입·유니크·outbox 컬럼 변경이 기존 행과 부딪힘(F6) |
| 6 | 동시성 안전 | **FAIL** | TTL 과 UNKNOWN 대기가 경합(F2). 포인트·쿠폰 발행 수, `order_saga` 락, 멀티행 예약 충돌(F5) |

Skillset 적용: arithmetic-verification → F8, nfr-anti-pattern-scan → F9·F3, concurrent-write-simulation → F2·F5.

## Findings

### F1 (Check 2) 코레오그래피 리스너가 남으면 이중 예약·결제 전 출고가 생긴다 — 심각

스펙은 기존 모듈에서 "고칠 것"만 적었고 **지울 것**은 적지 않았다.
- `spec.md:94` 는 fulfillment 에 대해 "명령 수신만 추가"라고 쓴다. 그런데 `fulfillment/.../FulfillmentEventConsumer.kt:27-32` 는 `inventory.stock.reserved` 를 받아 출고를 만든다. 이 리스너가 남으면 결제 전(재고 예약 단계)에 출고가 생긴다. 사가의 이행 명령이 두 번째 출고를 만들려 하면 새 유니크 `fulfillment_order(order_id, warehouse_id)`(`spec.md:61`)에 걸려 DLT 로 간다.
- `inventory/.../InventoryEventConsumer.kt:57-77` 는 `order.order.completed` 를 받아 재고를 예약한다. 사가가 "주문 CONFIRMED"(`spec.md:57`)에서 이 토픽을 계속 내면 **같은 주문을 두 번 예약한다**. 기존 멱등 pre-check 는 ACTIVE 예약만 본다(`InventoryService.kt:56`). 앞 단계에서 이미 CONFIRMED 가 됐으므로 이 검사를 통과한다.
- `inventory/.../InventoryEventConsumer.kt:99-119` 는 `fulfillment.order.shipped` 를 받아 확정한다. 새 흐름에서는 결제 직후에 확정하므로 출고 시점의 의미가 바뀐다.
- `order/.../OrderEventConsumer.kt:33-63` 는 `inventory.reservation.expired` 를 받으면 주문을 취소한다. 이것은 `spec.md:59` "주문을 먼저 취소하지 않는다"와 정면으로 충돌한다.

**수정안**: SR-4 에 "제거·대체되는 리스너" 표를 넣는다. 위 넷 각각을 제거할지, 사가 이벤트로 흡수할지 정한다. 새 흐름에서 `order.order.completed` 를 계속 발행할지, 발행한다면 누가 구독하는지도 적는다.

### F2 (Check 6) 결제 UNKNOWN 대기 중에 예약 TTL·주문서 만료가 먼저 터진다 — 심각

- `spec.md:24` TTL 15분은 "결제 대기 구간"에 걸리고, `spec.md:52` 쿠폰·포인트 예약은 "주문서 만료와 같이" 풀린다(주문서 만료 15분, `spec.md:48`).
- `spec.md:33` UNKNOWN 은 "지수 백오프 5회"로 결론을 낸다. 기저값이 없으니 합계가 15분을 넘을 수 있다(예: 1·2·4·8·16분 = 31분). `spec.md:59` 는 그동안 사가를 대기로 둔다.
- 현재 만료 스케줄러(`ReservationExpiryService.kt:41-46`)는 시각만 보고 ACTIVE 예약을 풀고 이벤트를 낸다. 결국 결제는 AUTHORIZED 로 수렴하는데 재고와 쿠폰은 이미 풀린 상태가 된다. 피벗 뒤라 보상도 안 하니(`spec.md:58`) "재고 확정" 재시도는 영영 성공하지 못하고 운영 큐로 간다.
- 주문서 15분 만료는 주문서 **생성** 시점부터 센다. 14분에 결제를 누르면 사가가 혜택을 예약한 뒤 1분 만에 풀린다.

**수정안**: 만료의 주인을 사가 하나로 정한다. 방법은 둘 중 하나다.
- (a) 사가가 결제 승인 명령을 내는 시점에 재고·혜택 예약을 "결제 진행 중"으로 표시하고, 만료 스케줄러는 이 상태를 건너뛴다.
- (b) 만료 스케줄러를 없애고 사가 타임아웃이 명시적으로 해제 명령을 낸다.

UNKNOWN 백오프의 기저·상한 시간도 숫자로 적는다. test-quality 의 "결제 확정 후 TTL 미적용"(`test-quality.md:23`) 옆에 "UNKNOWN 대기 중 TTL 미적용" 시나리오를 추가한다.

### F3 (Check 2·4·6) 아웃박스 릴레이 보강이 현재 구조로는 성립하지 않는다

- **SKIP LOCKED 가 1회 발행을 보장하지 못한다.** `OutboxPollingPublisher.kt:46-61` 는 `send()` 뒤 `whenComplete` 콜백(프로듀서 스레드)에서 PUBLISHED 로 바꾼다. `FOR UPDATE SKIP LOCKED` 락은 조회 트랜잭션이 커밋될 때 풀린다. 콜백이 오기 전에 다른 릴레이가 같은 행을 다시 집으므로 `test-quality.md:18` "두 릴레이 동시 실행에도 발행 1회"는 통과할 수 없다. 게다가 릴레이는 트랜잭션 매니저를 받지 않는다(`OrderMessagingConfig.kt:34-44`). 폴드 앱의 TM 은 도메인마다 따로 있다.
  → 동기 `send().get(timeout)` 을 도메인 TM 트랜잭션 안에서 부르거나, `IN_FLIGHT` + 리스 시각으로 선점하는 방식을 스펙에 정한다. 생성자에 `TransactionTemplate` 을 추가하는 것도 적는다.
- **파티션 키가 orderId 가 아니다.** 키는 `aggregateId` 다(`OutboxPollingPublisher.kt:46`, `OutboxPort.kt:13`). 그런데 inventory 는 aggregateId 로 `inventoryId`(`InventoryService.kt:106,143,179`)와 `reservation.id`(`ReservationExpiryService.kt:68`)를 넣는다. `spec.md:62` "모든 사가 이벤트 키 = orderId"를 지키려면 `OutboxPort.save` 에 명시적 `key` 인자를 추가해야 한다. 아니면 사가 이벤트의 aggregateId 를 orderId 로 통일한다. 스펙에 이 결정이 없다.
- **스키마 변경이 도메인 스키마마다 필요하다.** `spec.md:74,77` 의 시도 수·다음 시도 시각·FAILED·`traceparent` 헤더 복원을 하려면 `outbox_event` 에 컬럼이 늘어야 한다. 현재 엔티티(`OutboxEntity.kt:30-56`)에는 없다. 엔티티는 common 한 곳에 있지만 테이블은 order·inventory·fulfillment 스키마에 각각 있다. product 는 outbox 테이블 자체가 없다(`productdb/migration` 5개 중 없음). 새 4도메인까지 합하면 **8개 스키마에 마이그레이션**이 필요하고, 하나라도 빠지면 `validate` 에서 commerce 전체가 뜨지 않는다.
  → SR-6 에 "outbox 컬럼 추가 마이그레이션 × 기존 3 + product 신규 1 + 신규 4"와 인덱스 `(status, next_attempt_at)` 를 적는다.

### F4 (Check 2) 도메인 경계를 넘는 읽기 경로가 정해지지 않았다

규칙은 "서비스 간 DB 공유 금지"(`CLAUDE.md:40`)와 "Kafka(또는 HTTP)로만"(`ADR-0058:92`)이다. ADR-0099 는 여기에 "코디네이터가 다른 feature 빈을 부르지 않는다"(`ADR-0099:39`)를 더한다. 이 제약에서 아래 네 곳의 데이터 출처가 비어 있다.
1. **주문서**(`spec.md:48`): 동기 응답에 쿠폰·포인트 적용 결과, 판매자별 배송비, 수수료율이 들어간다. 원천은 promotion_db·seller_db 다. SR-0 이 HTTP 자기 호출을 없애므로(`spec.md:20`) 남는 선택지는 셋이다. order 가 쿠폰·사용자 쿠폰·포인트 잔액·판매자 요율을 읽기 모델로 복제하거나, promotion 견적 API 를 HTTP 로 부르거나, 주문서도 비동기로 만드는 것이다.
2. **PG 대사**(`spec.md:71`): ADR 표에서는 settlement 가 대사를 맡는데(`ADR-0099:48`) 대조 대상인 payment 행은 payment_db 에 있다(`ADR-0099:45`).
3. **정산 배치**(`spec.md:70`): 확정 라인·환불은 order_db 에 있다. 라인 스냅샷을 settlement 로 나르는 이벤트(예: `order.line.purchase-confirmed`)가 토픽 목록에 없다.
4. **판매자 상품 권한**(`spec.md:42`): product 가 "자기 상품"을 판정하려면 member→seller id 매핑과 판매자 상태가 필요하다. 이 정보는 seller_db 에 있다.

[[modular-monolith-fold]] 는 "원장·배치는 그것을 아는 도메인 모듈에 둔다"고 한다. 대사를 payment 에 둘지, settlement 가 결제 사본을 가질지 정해야 한다.

**수정안**: SR 마다 "데이터 출처" 한 줄(복제 이벤트 이름 또는 호출 경로)을 적는다. 1번은 범위가 가장 크게 갈리는 선택이라 사용자 확인을 받는 것이 낫다.

### F5 (Check 6) 동시 쓰기 제어가 주문 행에만 있다

- **포인트 초과 사용**: 원장이 추가만 한다(`spec.md:51`). 같은 사용자의 두 주문이 동시에 reserve 하면 잔액 검사와 적재 사이에 경합이 생긴다. 사용자별 잔액 행 `@Version` 이나 `SELECT … FOR UPDATE` 가 필요하다.
- **쿠폰 발행 수 초과**: "발행 수"(`spec.md:51`) 제한도 동시 발급에서 초과된다. 조건부 UPDATE(`issued < limit`)나 락을 명시한다.
- **`order_saga` 경합**: 이 행은 컨슈머(이벤트)와 타임아웃 스케줄러(`spec.md:56` "다음 타임아웃")가 함께 쓴다. `@Version` 은 orders 에만 있다(`spec.md:60`). 사가 행에도 버전을 두고, 충돌 시 다시 읽고 판정하도록 적는다.
- **예약 충돌이 DLT 로 샌다**: 한 주문의 여러 재고 행을 한 트랜잭션에서 예약하면(`spec.md:25`) 인기 상품에서 낙관 락 충돌이 난다. 현재 에러 핸들러는 1초 × 3회 뒤 DLT 로 보낸다(`OrderKafkaConfig.kt:73-83`과 같은 패턴). 그러면 사가는 결과를 못 받고 타임아웃까지 멈춘다. 충돌 재시도 N회 뒤에는 `inventory.reservation.failed(reason=CONFLICT)` 로 돌려주고, 데드락을 피하도록 행 갱신 순서를 `(product_id, warehouse_id)` 정렬로 고정한다.
- **Idempotency-Key 가 "처리 중"에서 멈춤**: 프로세스가 죽으면 24시간 동안 409 만 돌아간다(`spec.md:55`). 처리 중 레코드의 리스 만료 시간을 정한다.
- **판매자 정지가 늦게 먹힘**: JWT 에 `roles` 가 들어가므로(`auth/CLAUDE.md:95`) 정지 뒤 역할을 회수해도(`spec.md:41`) 토큰이 만료될 때까지 권한이 남는다. 판매자 API 가 seller 상태를 직접 확인하도록 적는다(루트 `CLAUDE.md` 블로그 절에 같은 교훈이 있다).

### F6 (Check 5) 마이그레이션·롤백 절이 없다

`k8s/CLAUDE.md:144-145`: 적용된 Flyway 가 있으면 이미지 태그 롤백이 듣지 않는다. 그런데 이 스펙은 기존 데이터를 바꾸는 변경을 여럿 담고 있다.
- **주문 상태 교체**: `OrderStatus.kt:3` 는 `PENDING, COMPLETED, CANCELLED` 인데 `spec.md:60` 에는 PENDING 이 없고 COMPLETED 는 "구매 확정"으로 뜻이 바뀐다. 기존 행을 어떻게 매핑할지가 없다. 옛 이미지로 되돌리면 `PAYMENT_PENDING` 행에서 enum 변환이 실패해 조회가 죽는다.
- **금액 타입 변경**: `spec.md:49` 는 "원 단위 정수"인데 현재는 `Money(BigDecimal)`(`order/.../Money.kt:6`)이고 컬럼은 `unit_price DECIMAL(19,2)`(`orderdb V1:16`)다. 타입을 옮기는지 유지하는지 적는다.
- **유니크 추가**(`spec.md:61`): 기존 코드는 같은 (order, product)에 CANCELLED/EXPIRED/CONFIRMED 가 여러 개 있을 수 있어서 **일부러** 유니크를 두지 않았다(`InventoryService.kt:54-55`). 운영 데이터에 중복이 있으면 마이그레이션이 실패하고 commerce 가 뜨지 않는다. 사전 중복 조회와 정리 SQL 을 배포 절차에 넣는다.
- **진행 중 주문 전환**: 배포 순간 옛 흐름에 있던 주문(ACTIVE 예약, 출고 전)을 새 사가가 어떻게 이어받는지 없다. "운영 진행 중 주문 0건 확인 후 전환"이라도 한 줄 적는다.
- `orders.version` 컬럼 추가, `product.seller_id` 백필(`spec.md:42`)의 순서(컬럼 nullable 추가 → 백필 → NOT NULL)도 적는다.

**수정안**: SR-7 에 단계별 "되돌릴 수 있는가" 표를 넣는다. 가산 변경(expand)을 먼저 배포하고, 옛 코드가 새 값을 읽어도 죽지 않게 한 뒤 전환한다(contract).

### F7 (Check 3) auth 에 Kafka 가 없다 — 숨은 작업량

`spec.md:41` 은 "auth 가 `seller.seller.approved` 를 받아 역할 행을 추가"한다고 쓴다. 하지만 auth 에는 Kafka 의존성이 없다(`auth/app/build.gradle.kts:7-31`). auth 는 폴드되지 않은 별도 앱이고 **private 서브모듈**이다(`auth/CLAUDE.md:3`). 필요한 작업은 컨슈머 설정, auth_db 멱등 원장 테이블, NetworkPolicy 확인(`07-allow-app-to-kafka.yaml` 은 part-of 라벨로 허용), 서브모듈 선푸시 순서다.

**수정안**: SR-2 에 이 작업을 명시한다. 이미 있는 ADMIN 역할 부여 API(`auth/CLAUDE.md:94`)를 seller 가 HTTP 로 부르는 대안과 비교해 한 줄로 결정한다.

### F8 (Arithmetic) 금액 규칙이 스펙과 테스트 문서에서 다르다

- **안분 잔차 위치**: `spec.md:50` 은 "금액이 가장 큰 라인"인데 `test-quality.md:10` 은 "마지막 라인"이다. 테스트가 판정 근거라 한쪽으로 맞춘다.
- **정산 지급액 식**: `spec.md:70` 은 "판매자 부담 할인"을 포함하는데 `test-quality.md:24` 는 "매출 − 수수료 − 환불분"뿐이다.
- **반올림 규칙이 없다**: 정률 쿠폰(`spec.md:51`), 수수료 `금액 × bp / 10000`(`spec.md:40,43`) 모두 반올림 모드(내림 등)와 적용 단위(라인별 vs 정산서 합계)가 없다. 라인별로 반올림한 합과 합계를 반올림한 값은 다르다. 그 차이가 "지급액 = 미지급금 변화량"(`spec.md:70`) 불변식을 깬다.
- **수수료 산정 기준이 없다**: 판매가인지, 판매자 부담 할인을 뺀 금액인지 정하지 않았다.
- 원 단위 `Long` 을 쓰는 것 자체는 KRW 고정이라 타당하다. skillset 은 BigDecimal 을 권하지만 대체 조건은 "정수 + 반올림 규칙 명시"다.

**수정안**: SR-5 에 기록 시점 4개(`spec.md:69`)별 분개 템플릿(차·대 계정과 금액 식)을 표로 넣는다.

### F9 (NFR) 모든 `@Scheduled` 가 스레드 하나를 나눠 쓴다

commerce 설정에는 `spring.task.scheduling.pool.size` 가 없고 가상 스레드도 꺼져 있다(`commerce/app/src/main/resources/application.yml` 에 `task`·`virtual` 없음). 그래서 Spring 기본값인 **스케줄러 스레드 1개**로 돈다. 지금도 도메인별 릴레이 3개(`OutboxPollingPublisher.kt:31`)와 만료 스케줄러(`ReservationExpiryService.kt:31`), 재고 대사가 이 스레드를 나눠 쓴다. 이 스펙이 더하는 것은 릴레이 5개(product + 신규 4), UNKNOWN 재조회(`spec.md:33`), 사가 타임아웃(`spec.md:56`), 구매 확정(`spec.md:67`), 정산·대사 배치(`spec.md:70-71`), 정리 작업(`spec.md:74`)이다. 일 1회 배치 하나가 도는 동안 모든 아웃박스 발행이 멈추고, 사가 지연으로 이어진다.

**수정안**: 풀 크기(예: 4)를 정하거나 배치를 별도 실행기로 분리한다고 SR-6 에 적는다. 1200Mi 한도 안에서 잰 값을 `spec.md:83` 측정 항목에 추가한다.

### F10 (Check 3) 사가 명령·이벤트 토픽이 결제 것만 적혀 있다

`spec.md:36` 에는 payment 토픽만 있다. 아래 토픽들은 이름이 없다.
- 재고 예약·확정·해제 명령
- 혜택 reserve·confirm·cancel 명령과 결과
- 이행 생성 명령
- 판매자 승인·정지
- 정산용 라인 확정 이벤트(F4)

`kafka-convention.md` 갱신(`spec.md:86`)과 DLT 매핑 표(`kafka-convention.md:43-60`)는 이름이 있어야 할 수 있다. 또 `spec.md:26` 은 확정·만료도 재고 동기화 이벤트를 낸다고 하는데, product 컨슈머는 `reserved·released·received` 만 구독한다(`InventoryStockSyncConsumer.kt:43-47`). 구독 추가도 적는다.

### F11 (Check 3) 운영 큐·시크릿·외부 호출 게이트

- **운영 큐의 소유 도메인이 없다**(`spec.md:75-76`). 항목이 payment·settlement·order·DLT 에 걸쳐 있는데 스키마는 도메인별이다. 어느 도메인이 테이블을 갖고, 다른 도메인은 이벤트로 적재하는지 정한다.
- **시크릿 이름**: 계좌 암호화 키, 웹훅 서명 키, 토스 테스트 키를 적지 않았다. [[modular-monolith-fold]] 「장애 반경」절에 따르면 시크릿 하나가 빠지면 **폴드 그룹 전체**(commerce 열 도메인)가 `CreateContainerConfigError` 로 조용히 멈춘다. 이름과 `optional` 정책을 SR-7 에 적는다.
- **쿼터 게이트 누락**: `requirements.md:24` 의 `ExternalApiProvider` 쿼터 게이트(ADR-0082)가 spec.md 에서 빠졌다. 토스 어댑터가 외부 호스트를 부르면 `verifyExternalApiQuota`(`build.gradle.kts:175-193`)에 걸릴 수 있다.
- **빈 이름 충돌**: `circuitBreakerRegistry` 빈이 도메인 접두사 없이 등록돼 있다(`order/.../WebClientConfig.kt:30-40`). payment 로 옮기면서 order 쪽에도 남기면 빈 이름이 충돌한다([[modular-monolith-fold]] §3). 이동인지 복제인지 적는다.

## 문제 없음으로 확인한 것

- 타임아웃: `spec.md:27` 이 연결 3초·읽기 5초를 명시했다. 현재 `WebClientConfig.kt:20-28` 에는 타임아웃이 없어 실제 결함이 맞다.
- 이중 인코딩 지적(`spec.md:22`): `OrderKafkaConfig.kt:44` 의 `JacksonJsonSerializer` 에 이미 문자열인 JSON(`OutboxPollingPublisher.kt:44`)을 넘기는 구조와 일치한다. 테스트 판정 근거("첫 글자 `{`")도 대상 산출물을 본다.
- Hikari 도메인당 3(`spec.md:83`)은 기존 폴드 설정(`commerce/app/.../application.yml:31` 등)과 같다.

## 요약

심각 2건(F1 리스너 잔존, F2 TTL과 UNKNOWN 경합), 구조 2건(F3 릴레이, F4 경계 읽기), 나머지 7건. 모두 스펙 문구를 보완해서 풀 수 있다. F4-1(주문서가 혜택 데이터를 얻는 방식)은 범위가 크게 갈리므로 사용자 확인을 권한다.

VERDICT: REVISE

## Round 2

- 일자: 2026-09-24. 대상은 개정된 `spec.md`(252줄), `planning/test-quality.md`, `planning/requirements.md` §「리뷰 후 추가 결정」, `ADR-0099`.
- 1차 줄 번호는 옛 스펙 기준이다. 아래 인용은 개정본 기준이다.

### 1차 이슈 해소 여부

| # | 판정 | 개정본 근거 |
|---|---|---|
| F1 리스너 잔존 | 해소 | `spec.md:47-58` SR-1 은퇴 표에 다섯 구독과 옛 토픽 두 개의 대체가 적혔다. `ADR-0099:69`, 회귀 시나리오 `test-quality.md:57` |
| F2 TTL·UNKNOWN 경합 | 해소 | `spec.md:104`: 보류 30분 > 피벗 전 10분 + 재조회 10분. 0.5+1+2+4+2.5 = 10분으로 산술이 맞다. 현행 TTL 30분(`InventoryService.kt:44`)과도 같다. 만료가 먼저 오면 VOID 로 처리하고, 시나리오는 `test-quality.md:53` 이다. 남은 전이 누락은 N2 에 적었다 |
| F3 아웃박스 | 대부분 해소 | `spec.md:152` 는 SENDING + 리스 + 트랜잭션 밖 동기 전송이다. 키는 `spec.md:106` 의 `partition_key`, 스키마 목록은 `spec.md:152` 에 있다. 다만 quant 를 넣은 것은 새 오류다(N4) |
| F4 경계 읽기 | 해소 | `spec.md:91-95` SR-3 에 읽기 모델을 두고, `requirements.md:105` 에 사용자 결정이 있다. 정산 원천은 `spec.md:148-149`, 대사는 payment 가 맡는다(`spec.md:117`). 판매자 권한 원천은 `spec.md:190` 이다 |
| F5 동시 쓰기 | 해소 | 포인트 `@Version`(`spec.md:131`), 쿠폰 조건부 UPDATE(`spec.md:130`), `order_saga` `@Version`(`spec.md:100`), id 오름차순 `FOR UPDATE`(`spec.md:43`), 리스 60초(`spec.md:98`), 매 요청 ACTIVE 확인(`spec.md:123`)이 모두 들어갔다 |
| F6 마이그레이션·롤백 | 대부분 해소 | `spec.md:195-202` SR-13 이 생겼다. 다만 진행 중 예약 전환의 수량 처리가 비었다(N3) |
| F7 auth Kafka | 해소 | `spec.md:122`, `spec.md:207`. 역할 행 추가·회수는 원래 멱등이라 원장이 없어도 된다 |
| F8 금액 규칙 | 일부 해소 | 잔차 위치(`spec.md:136` = `test-quality.md:33`), 반올림(`spec.md:135`), 지급액 식(`spec.md:149` = `test-quality.md:63`)은 맞춰졌다. 「환불 상계」와 「순매출」 정의가 비어 있다(N1) |
| F9 스케줄러 스레드 | 해소 | `spec.md:153` 풀 4 |
| F10 토픽 | 해소 | `spec.md:174-193` SR-12 표. product 수신에 `confirmed·restocked` 도 포함된다(`spec.md:180`) |
| F11 운영 큐·시크릿·게이트·빈 | 해소 | 도메인별 `ops_issue` 는 `spec.md:154`, Secret 은 `spec.md:206`, 빈 접두사는 `spec.md:234` 에 있다. 쿼터 게이트는 이제 해당이 없다. 토스 호스트가 `externalApiHosts`(`build.gradle.kts:161-165`)에 없고, 운영에서 토스를 켜는 일은 범위 밖이다(`spec.md:243`) |

### 새 이슈

#### N1 (Arithmetic, 심각) 「환불 상계」가 이중 차감이 되거나 영원히 0이다

- `spec.md:75` 는 COMPLETED 뒤 부분 환불을 「구매 확정 전 라인만」으로 제한한다. `spec.md:143` 은 「확정된 라인만 정산 대상」이다. 따라서 환불된 라인은 `order.line.purchase-confirmed` 가 되지 않아 **매출에 들어가지 않는다**.
- 그런데 `spec.md:149` 는 그 환불을 「환불 상계」로 한 번 더 뺀다. 구현자가 식을 그대로 옮기면 판매자에게 덜 지급한다. 예: L1 10,000원 확정, L2 5,000원 환불이면 지급액이 10,000 − 5,000 이 된다.
- 원장도 같은 방향으로 어긋난다. 매입 시점(`order.order.confirmed`)에 전 라인을 미지급금으로 올리고 환불 시점에 내리면, 미지급금 잔액은 L1 몫이다. 정산서 지급액(L1 − L2)과 「미지급금 감소분」 불변식(`spec.md:149`, `ADR-0099:59`)이 맞지 않는다.
- `CARRIED_OVER`(`spec.md:85`)는 환불 상계가 있어야만 생기는 상태다. 지금 규칙에서는 도달할 수 없다.
- 수수료 기준 「라인 순매출」(`spec.md:135`)도 정의가 없다. 판매가 × 수량인지, 판매자 부담 할인을 뺀 값인지, 전체 할인을 뺀 값인지 정해야 한다. 기준에 따라 수수료 원 단위 값이 달라진다.

**수정안**: 방법은 둘 중 하나다.
- (a) 「환불 상계」 항과 `CARRIED_OVER` 를 뺀다.
- (b) 「환불 상계 = 이전 정산서에서 이미 지급된 라인의 환불」로 정의하고, 확정 뒤 환불을 허용하도록 SR-2 를 고친다.

어느 쪽이든 매입·환불·지급 세 시점의 분개(차·대 계정과 금액 식)를 한 표로 적는다. 「순매출」 식도 함께 적는다.

#### N2 (Check 6) 보류 만료 → VOID 경로에 필요한 주문 전이와 확정 명령 응답이 없다

- `spec.md:104`: 결제가 AUTHORIZED 인데 보류가 먼저 만료되면 VOID 하고 주문을 FAILED 로 둔다. 그런데 AUTHORIZED 를 받는 순간 주문은 PAID 가 된다(`spec.md:70`). 주문 전이 표(`spec.md:64-75`)에는 PAID → FAILED 가 없다. `spec.md:89` 대로 도메인 가드만 전이를 허용하면 이 경로는 예외로 끝난다. 시나리오 `test-quality.md:53`(★)도 통과하지 못한다.
- 같은 창에서 코디네이터는 이미 `inventory.command.confirm`(또는 `promotion.command.confirm`)을 냈을 수 있다. 만료된 예약에 확정 명령이 오면 `Reservation.confirm()`(`Reservation.kt:58`)은 ACTIVE 가드에 걸려 예외를 던진다. 그러면 DLT 로 간다. 한편 피벗 뒤라 「재시도만」(`spec.md:103`) 규칙이 돌아서, 10회 뒤 STUCK 이 되고 운영 이슈가 VOID 흐름과 따로 생긴다.

**수정안**:
- SR-2 표에 `PAID → FAILED`(사유 HOLD_EXPIRED, VOID 완료 뒤)를 넣는다.
- 확정 명령을 받았는데 예약·보류가 ACTIVE 가 아니면 예외 대신 `inventory.reservation.failed` / `promotion.hold.failed`(reason=EXPIRED)로 답한다고 적는다.
- 코디네이터가 만료 이벤트를 받으면 피벗 뒤 재시도를 멈춘다고 적는다.

#### N3 (Check 5) 진행 중 예약을 CONFIRMED 로 바꾸는 마이그레이션이 수량을 안 맞춘다

- `spec.md:200` 은 「COMPLETED 인데 예약 ACTIVE」를 전환 마이그레이션이 CONFIRMED 로 맞춘다고 쓴다. 그런데 확정은 상태 값만 바꾸는 일이 아니다. `Inventory.confirm()`(`Inventory.kt:57-60`)은 `reserved_qty` 를 줄인다. SQL 로 `reservation.status` 만 갱신하면 `reserved_qty` 가 영구히 부풀고, 그만큼 팔 수 있는 재고가 없는 것으로 남는다. product 쪽 동기화 이벤트(`inventory.stock.confirmed`)도 나가지 않는다.
- 주문 상태는 order_db 에, 예약은 inventory_db 에 있다. 도메인별 `ScopedFlywayMigrator` 로는 한 마이그레이션이 두 스키마를 볼 수 없다. 조건 「COMPLETED 인데」를 inventory 마이그레이션이 판정할 수 없다.

**수정안**: inventory 마이그레이션 하나로 적는다. 옛 흐름에서 ACTIVE 예약은 전부 COMPLETED 주문에서만 생기므로(`InventoryEventConsumer` 가 `order.order.completed` 에서 예약), 조건 없이 ACTIVE 전부를 대상으로 한다. 같은 SQL 에서 `inventory.reserved_qty -= 예약 수량` 을 하고, `outbox_event` 에 `inventory.stock.confirmed` 행을 넣는다. 아니면 일회성 애플리케이션 러너로 도메인 메서드를 부른다. 어느 쪽인지 SR-13 에 한 줄 적는다.

#### N4 (Check 2) quant 는 common 아웃박스를 쓰지 않고, commerce 도 아니다

- `spec.md:152` 는 「common, 모든 사용 스키마에 적용 — … quant …」라고 쓴다. 그런데 quant 는 자체 `OutboxEntity`·`OutboxRelay` 를 쓰고 Postgres 를 대상으로 한다(`quant/.../outbox/OutboxRelay.kt:48-101`, `quant/CLAUDE.md` 「자체 Outbox(`OutboxRelay`, Postgres)는 형태가 달라 별도 검토」). 호스트도 sideapp 이다.
- 그래서 common 에 컬럼을 추가해도 quant 스키마에는 적용되지 않는다. quant 에 마이그레이션을 넣으면 쓰지 않는 컬럼만 생기고, 그 작업이 이 스펙 P0 범위를 sideapp 배포까지 넓힌다.
- 부수 사항: 상태가 문자열이다(`OutboxEntity.kt:50`). 확장 단계에서 롤백하면, 옛 릴레이는 `PENDING` 만 집으므로 `SENDING` 으로 남은 행이 영영 발행되지 않는다. 「옛 코드와 공존」(`spec.md:152`)을 유지하려면 롤백 절차에 `SENDING → PENDING` 되돌리기 한 줄이 필요하다.

**수정안**: `spec.md:152` 목록에서 quant 를 빼고, quant 는 범위 밖(자체 릴레이)이라고 적는다. SR-13 롤백 항에 SENDING 되돌리기를 넣는다.

#### N5 (Check 3, 경미) 운영 큐 화면의 합치는 범위가 스키마 목록과 다르다

`spec.md:154` 는 「각 도메인 스키마의 `ops_issue`」와 「DLT 컨슈머(도메인별)」를 쓴다. 이 범위라면 inventory·fulfillment·product 의 DLT 도 포함된다. 그런데 `spec.md:155` 화면은 「네 도메인」만 합친다. 그대로 구현하면 기존 도메인의 DLT 가 화면에 안 보인다. 「ops_issue 를 가진 모든 도메인」으로 고치거나, 어느 도메인들인지 이름을 적는다.

### 체크리스트 재판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 존재 | PASS |
| 2 | 기존 코드와 충돌 | PARTIAL — N4 |
| 3 | 복잡도 리스크 | PASS (N5 경미) |
| 4 | NFR | PASS |
| 5 | 마이그레이션·롤백 | PARTIAL — N3, N4 부수 |
| 6 | 동시성 | PARTIAL — N2 |

### 요약

1차 11건 중 9건은 해소, 2건(F3·F8)은 일부만 해소됐다. 새 이슈는 5건이다. 그중 N1(정산식)과 N2(PAID → FAILED 누락)는 그대로 구현하면 값이 틀리거나 핵심 E2E 가 막힌다. 모두 스펙 문구만 고치면 풀리고, 사용자 판단이 필요한 것은 N1 의 (a)/(b) 선택 하나다.

VERDICT: REVISE
