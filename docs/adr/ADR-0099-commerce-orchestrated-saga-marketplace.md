# ADR-0099 — commerce: 오케스트레이션 사가 + 결제·판매자·혜택·정산 폴드

- 상태: 채택 (2026-09-24)
- 대체: ADR-0032 의 「오케스트레이터 기각(Alt D)」과 사가 순서(결제 → 재고). 아웃박스·보상 이벤트 설계는 유지
- 관련: ADR-0011(재고·이행 코레오그래피), ADR-0012/0029(멱등 컨슈머), ADR-0015(장애 대비), ADR-0028(추적),
  ADR-0058/0093(폴드 호스트), ADR-0083(레이어 표준), ADR-0031/0070(egress), ADR-0082(외부 호출 쿼터)
- 스펙: `docs/specs/2026-09-24-commerce-enterprise/`

## 맥락

2026-09-24 코드 점검에서 commerce 는 아웃박스·멱등 컨슈머·DLT 를 갖췄지만 거래 층이 비어 있었다.

| 결함 | 결과 |
|---|---|
| 결제 서비스가 없고 주소가 `localhost:9090` 기본값 | 운영 주문이 결제 단계에서 실패 |
| 사가 순서가 결제 → 재고 | 재고 부족이 피벗 뒤 실패가 되어 DLT 로 새고 결제된 주문이 방치 |
| 예약 TTL 30분이 결제 후에도 적용 | 결제된 재고가 다시 팔림, 주문 취소는 PENDING 가드에 막혀 DLT |
| 결제 예외를 실패로 처리 | PG 에서 돈이 빠졌어도 주문 취소 |
| 클라이언트가 단가를 보냄 | 가격 위변조 가능 |
| 판매자·정산·원장 없음 | 마켓플레이스로 확장 불가 |

ADR-0032 는 단계가 셋(주문·재고·이행)일 때 코레오그래피를 골랐다. 결제·혜택이 들어오면 단계가 여덟, 보상이 셋이 된다.

## 결정

### 1) 사가는 order 안의 코디네이터가 오케스트레이션한다

- `order_saga` 상태 테이블이 단계·시도·타임아웃을 갖는다. 코디네이터는 이벤트를 받아 다음 **명령**을 아웃박스로 낸다.
- 순서는 보상 가능 단계 → 피벗 → 재시도 가능 단계다: 재고 예약 → 혜택 예약 → **결제 승인** → 재고 확정 → 혜택 확정 → 매입 → 주문 확정 → 이행 생성.
- 피벗 뒤 실패는 보상하지 않고 재시도하며, 한도 초과는 운영 큐로 간다.
- 결제 결과 미상(UNKNOWN)은 사가를 대기로 두고, 결제 도메인의 재조회 결과를 기다린다.

| 후보 | 판단 |
|---|---|
| 코레오그래피 유지 | 흐름이 네 컨슈머에 흩어져 순서 결함이 리뷰를 통과했다. 기각 |
| 별도 오케스트레이터 파드 | 무료 티어 제약(ADR-0093). 기각 |
| **order 안 코디네이터** | 주문이 사가의 주인이고 상태 이력과 한 트랜잭션에 둘 수 있다. 채택 |

도메인 간 통신은 계속 Kafka 다(ADR-0058 불변식 2). 코디네이터가 다른 feature 빈을 부르지 않는다.

### 2) 새 도메인 넷을 `commerce:app` 에 폴드한다

| 도메인 | 스키마 | 책임 |
|---|---|---|
| `payment` | `payment_db` | 결제 상태 머신, PgPort(모의·토스), 멱등·재조회·웹훅, **PG 대사**(결과를 이벤트로) |
| `seller` | `seller_db` | 입점·승인·수수료율·정산 주기·계좌 |
| `promotion` | `promotion_db` | 쿠폰·포인트, TCC 예약 |
| `settlement` | `settlement_db` | 복식부기 원장, 정산서, 지급 (대사 결과는 payment 이벤트로 받는다) |

돈이 오가는 트랜잭션이라 호스트 성격표(ADR-0093)상 commerce 다. 새 파드는 없다. 도메인당 Hikari 풀 최대 3.

### 3) 결제는 포트 뒤 두 어댑터, 운영은 모의 PG

- 모의 PG 는 승인·거절·타임아웃·지연 웹훅·정산 파일을 결정적으로 만든다. 사가 E2E 가 이것으로 돈다.
- 토스페이먼츠 어댑터는 `payment.pg=toss` 일 때만 켜진다. commerce 는 상시 파드라 egress 가 닫혀 있고(ADR-0031/0070), 운영 활성화는 egress 예외를 따로 결정한다.

### 4) 원장은 추가만 한다

거래(journal) 하나의 차변 합 = 대변 합을 도메인이 강제하고, 정정은 역분개로만 한다. 정산서 지급액은 판매자 미지급금 잔액 변화량과 같아야 한다.

### 5) 금액은 서버가 정한다

클라이언트는 주문서 id 만 보낸다. 주문 라인은 상품명·판매가·안분 할인·부담 주체·수수료율·판매자를 스냅샷한다. 금액은 원 단위 정수(KRW).

### 6) 경계를 넘는 읽기는 읽기 모델, 기존 코레오그래피 구독은 은퇴

- 주문서는 상품·판매자·쿠폰·포인트를 동기로 계산해야 한다. 다른 feature 빈 호출(ADR-0058 불변식 1)과 HTTP 자기 호출이 모두 막혀 있으므로 order 가 이벤트로 읽기 모델을 유지한다. 주문서 할인은 견적이고 최종 판정은 사가의 TCC reserve 다.
- settlement 는 order 의 라인 이벤트로, PG 대사 결과는 payment 의 이벤트로 받는다. 다른 스키마를 읽지 않는다.
- ADR-0011/0032 의 구독(inventory ← `order.order.completed`/`cancelled`, fulfillment ← `inventory.stock.reserved`, order ← `inventory.reservation.expired` 직접 취소, inventory ← `fulfillment.order.shipped` 확정)은 명령 토픽으로 대체하고 지운다.

### 7) `COMPLETED` 는 구매 확정으로 재정의한다

지금의 `COMPLETED`(결제 직후)는 `CONFIRMED` 가 되고, `COMPLETED` 는 구매 확정이다. 기존 행은 COMPLETED → CONFIRMED, 남은 PENDING → FAILED 로 옮긴다. `order.order.completed` 토픽은 은퇴해 옛 의미의 이벤트가 새 의미로 읽히지 않는다.

### 8) 판매자 역할은 이벤트로 auth 에 반영하고, 판정은 행으로 한다

seller 승인·정지 이벤트를 auth 가 받아 `ROLE_SELLER` 행만 추가·회수한다. 브로커가 무인증이라 이 경로로 역할이 위조될 위험은 **ROLE_SELLER 한 역할로 범위를 고정하는 것으로 수용**한다. 판매자 API 는 JWT 역할이 아니라 매 요청 seller 행의 ACTIVE 로 판정해 정지가 토큰 만료를 기다리지 않는다(ADR-0072 와 같은 이유).

## 결과

- 주문 API 는 202 + 상태 조회로 바뀐다. FE 는 결제 대기 화면을 갖는다.
- `PRODUCT_SERVICE_URL`·`PAYMENT_SERVICE_URL` 의존이 사라진다. order 는 product 이벤트로 상품 스냅샷을 유지한다.
- 운영 MySQL 은 이미 떠 있어 init 스크립트가 재실행되지 않는다. 새 스키마·계정은 배포 전 수동 생성하고 init 파일도 같이 고친다.
- 한 이미지가 열 도메인을 올린다. 한 도메인 테스트 실패가 전체 배포를 막는 기존 성질이 더 커진다.

### 구현 결과 (2026-09-24)

P0~P6 을 단계마다 운영에 배포했다(P7 은 운영 큐·DLT·추적·문서 마감). 운영(oci-arm)에서 주문 1건이 10초에 FULFILLING·사가 COMPLETED 까지 가고,
같은 주문의 전체 취소 클레임이 6초에 REFUNDED 로 끝났으며, settlement 가 두 건을 원장에 차 = 대로 남겼다.

| 영역 | 들어간 것 |
|---|---|
| 사가 | order 코디네이터(`order_saga`, `@Version`) · 명령 토픽 넷(재고·혜택·결제·이행) · 피벗 전 보상 · 피벗 뒤 재시도·STUCK · 보류 만료 VOID · 0원 주문 · `Idempotency-Key` |
| 옛 흐름 은퇴 | `order.order.completed`·`cancelled` 토픽과 그 구독, fulfillment ← `inventory.stock.reserved`, order 의 HTTP 자기 호출·`PaymentAdapter` 삭제 · 옛 ACTIVE 예약 기동 시 1회 확정 |
| 새 도메인 넷 | seller(입점·승인·정지, ROLE_SELLER 연동, 계좌 AES-GCM) · payment(모의 PG·토스 어댑터·UNKNOWN 재조회·대사) · promotion(쿠폰·포인트·TCC 보류) · settlement(복식부기 원장·정산서·모의 지급) |
| 금액·주문서 | 장바구니 · 주문서 스냅샷 · 안분 · 수수료 · 원 단위 `Long`(확장 단계, 옛 DECIMAL 컬럼 삭제는 다음 단계) |
| 클레임 | 전체·부분 취소 · 이행 취소 → 판매자 결정 · 재입고 · 혜택 원복 · 부분 환불 · 구매 확정(수동·7일 자동) |
| 운영 | 아웃박스 보강(`SKIP LOCKED`·리스·재시도 한도) · 도메인별 `ops_issue` + DLT 적재·재발행 · 운영 큐 화면 · traceparent 전파 · 사가·결제·정산 지표 |

구현 중에 발견해 함께 고친 기존 결함: commerce 에 `@EnableKafka` 가 없어 모든 `@KafkaListener` 가 운영에서 등록된 적이 없었다 ·
DLT 가 규약 `.DLT` 가 아니라 Spring Kafka 4 기본 `-dlt` 로 가고 있었다 · 운영 `orders.status` 가 Hibernate 가 만든 ENUM 이라 새 상태 INSERT 가 잘렸다 ·
common 아웃박스 엔티티에 기본 생성자가 없어 옛 릴레이가 행을 못 읽었다.

**남은 질문**은 스펙 `docs/specs/2026-09-24-commerce-enterprise/context/open-questions.yml` 의 post-impl 항목이다. 큰 것만:
토스 운영 활성화(egress 예외), 재고·창고·이행 API 의 판매자 소유 검사 부재, 운영 스키마의 다른 Hibernate ENUM 컬럼,
`@EnableKafka` 위치, 운영에 남은 `-dlt` 토픽 레코드.
