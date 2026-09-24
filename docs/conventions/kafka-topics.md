# Kafka Topic Convention

## Naming Format

```
{domain}.{entity}.{event}
```

## Topic Registry

| Topic | Publisher | Consumer | Description |
|-------|----------|----------|-------------|
| `product.item.created` | product (아웃박스) | search-consumer · order 읽기 모델 | 상품 생성 이벤트 |
| `product.item.updated` | product (아웃박스) | search-consumer · order 읽기 모델 | 상품 수정 이벤트 |
| `{inventory,promotion,payment,fulfillment}.command.*` | order (사가·클레임) | 각 참여자 | 주문 사가 명령 (키 = orderId, ADR-0099) |
| `inventory.reservation.*` · `promotion.hold.*` · `payment.payment.*` · `fulfillment.order.*` | 각 참여자 | order | 명령의 답 (키 = orderId) |
| `order.order.confirmed` · `order.claim.refunded` · `order.line.purchase-confirmed` | order | settlement | 정산 원천 이벤트 |
| `seller.seller.*` · `promotion.coupon.*` · `promotion.point.changed` · `payment.reconciliation.settled` · `inventory.stock.*` | seller · promotion · payment · inventory | order · product · auth · settlement | 읽기 모델·동기화 |
| ~~`order.order.completed`~~ · ~~`order.order.cancelled`~~ | — | — | **은퇴** (ADR-0099) — 이름을 다시 쓰지 않는다 |

commerce 토픽의 전체 표(토픽별 발행·수신·컨슈머 그룹)는 `docs/architecture/kafka-convention.md` 가 원본이다.

## Consumer Group Naming

Format: `{service}-{purpose}`

| Consumer Group ID | Service | Purpose |
|-------------------|---------|---------|
| `search-indexer` | search-consumer | ES 증분 색인 |
| `order-saga` · `order-claim` · `order-read-model` | commerce (order) | 사가 답 · 클레임 답 · 읽기 모델 |
| `inventory-service` · `promotion-service` · `payment-service` · `fulfillment-service` | commerce | 사가 명령 처리 |
| `settlement-ledger` | commerce (settlement) | 원장·정산 원천 |
| `product-stock-sync` · `product-seller-sync` | commerce (product) | 재고 사본 · 판매자 읽기 모델 |
| `auth-seller-role` | auth | ROLE_SELLER 부여·회수 |
| `{domain}-dlt-ops` | commerce 도메인 일곱(구독 토픽이 없는 seller 제외) | DLT → 운영 이슈 적재 |

## DLQ (Dead Letter Queue)

- 이름은 `<원 토픽>.DLT` — 규약 원본은 `docs/architecture/kafka-convention.md` §Dead Letter Queue
- Spring Kafka 4 기본값(`-dlt`)을 그대로 쓰지 않는다 — common `DltKafka.deadLetterRecoverer` 로 명시

## CDC Topics (Future - see docs/architecture/cdc-pipeline.md)

CDC 도입 시 Debezium 토픽:
- `dbz.commerce.products` (product_db binlog 기반)
