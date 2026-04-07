# Communication Strategy

## 1. Synchronous Communication

사용 기술:
- WebClient

사용 대상:
- Gateway -> 내부 서비스
- 외부 API 호출

### Rule
- 반드시 CircuitBreaker 적용 (Resilience4j)
- Timeout 설정 필수
- Retry 정책 명시
- Coroutine suspend 함수로 호출

---

## 2. Asynchronous Communication

사용 기술:
- Kafka

목적:
- 도메인 이벤트 전파
- 검색 인덱스 업데이트
- 서비스 간 결합도 감소

패턴:
- Outbox 패턴 (inventory, fulfillment)

---

## 3. Kafka Topic Naming Convention

형식:

`{domain}.{entity}.{event}`

예:
- `product.item.created`
- `order.order.completed`

상세: `docs/architecture/kafka-convention.md`

---

## 4. 서비스 간 이벤트 흐름

### 4.1 이벤트 발행/수신 매트릭스

| 발행 서비스 | 토픽 | 수신 서비스 |
|------------|------|------------|
| product | `product.item.created` | search |
| product | `product.item.updated` | search |
| order | `order.order.completed` | inventory |
| order | `order.order.cancelled` | inventory |
| inventory | `inventory.stock.reserved` | fulfillment, product |
| inventory | `inventory.stock.released` | product |
| inventory | `inventory.stock.confirmed` | - |
| inventory | `inventory.stock.received` | product |
| inventory | `inventory.reservation.expired` | order |
| fulfillment | `fulfillment.order.created` | - |
| fulfillment | `fulfillment.order.shipped` | inventory |
| fulfillment | `fulfillment.order.delivered` | - |
| fulfillment | `fulfillment.order.cancelled` | inventory |

### 4.2 주요 이벤트 시퀀스

#### 주문 완료 -> 재고 차감 -> 출고 생성

```
Order ---(order.order.completed)---> Inventory
                                        |
                              (재고 예약/차감)
                                        |
                       (inventory.stock.reserved)
                              |                 |
                              v                 v
                        Fulfillment          Product
                        (출고 생성)        (수량 동기화)
```

#### 주문 취소 -> 재고 해제

```
Order ---(order.order.cancelled)---> Inventory
                                        |
                                  (재고 해제)
                                        |
                          (inventory.stock.released)
                                        |
                                        v
                                    Product
                                 (수량 복원)
```

#### 출고 완료 -> 재고 확정

```
Fulfillment ---(fulfillment.order.shipped)---> Inventory
                                                  |
                                            (재고 확정)
```

#### 출고 취소 -> 재고 해제

```
Fulfillment ---(fulfillment.order.cancelled)---> Inventory
                                                    |
                                              (재고 해제)
```

#### 상품 변경 -> 검색 인덱스 갱신

```
Product ---(product.item.created/updated)---> Search Consumer
                                                  |
                                           (ES 인덱스 갱신)
```

#### 재고 예약 만료 -> 주문 취소

```
Inventory ---(inventory.reservation.expired)---> Order
                                                   |
                                             (주문 취소 처리)
```

---

## 5. 동기 API 호출 관계

| 호출자 | 대상 | 용도 |
|--------|------|------|
| Gateway | 모든 내부 서비스 | API 라우팅 |

---

## 6. WebClient Standard Pattern

- Base URL 분리
- Timeout 설정
- CircuitBreaker 적용 (Resilience4j)
- 공통 Error Mapping
- suspend 함수 기반

---

## 7. CircuitBreaker Standard

- Resilience4j 사용
- 실패율 기반 오픈
- Half-open 상태 지원
- fallback은 최소화

---

## 8. Dead Letter Queue (DLQ)

처리 실패 메시지는 원래 토픽에 `.DLT` 접미사가 붙은 토픽으로 자동 전송된다.
Spring Kafka의 `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`를 사용한다.

- 재시도: 1초 간격(`FixedBackOff`), 최대 3회
- 3회 실패 후 DLQ 토픽으로 전송
- AckMode: `RECORD`

상세: `docs/architecture/kafka-convention.md`
