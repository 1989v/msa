# Kafka Topic Convention

## 형식

`{domain}.{entity}.{event}`

## 토픽 목록

| 토픽 | 발행 서비스 | 수신 서비스 |
|------|------------|------------|
| `product.item.created` | product | search |
| `product.item.updated` | product | search |
| `order.order.completed` | order | inventory |
| `order.order.cancelled` | order | inventory |
| `inventory.stock.reserved` | inventory | fulfillment, product |
| `inventory.stock.released` | inventory | product |
| `inventory.stock.confirmed` | inventory | - |
| `inventory.stock.received` | inventory | product |
| `inventory.reservation.expired` | inventory | order |
| `fulfillment.order.created` | fulfillment | - |
| `fulfillment.order.shipped` | fulfillment | inventory |
| `fulfillment.order.delivered` | fulfillment | - |
| `fulfillment.order.cancelled` | fulfillment | inventory |

## Consumer Group ID

형식: `{service}-{purpose}` (예: `search-indexer`, `inventory-service`, `fulfillment-service`, `product-stock-sync`)

## Dead Letter Queue (DLQ)

처리 실패 메시지는 원래 토픽에 `.DLT` 접미사가 붙은 토픽으로 자동 전송된다.
Spring Kafka의 `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`를 사용한다.

- 재시도: 1초 간격(`FixedBackOff`), 최대 3회
- 3회 실패 후 DLQ 토픽으로 전송

| DLQ 토픽 | 원본 토픽 |
|---------|----------|
| `order.order.completed.DLT` | `order.order.completed` |
| `order.order.cancelled.DLT` | `order.order.cancelled` |
| `inventory.stock.reserved.DLT` | `inventory.stock.reserved` |
| `inventory.stock.released.DLT` | `inventory.stock.released` |
| `inventory.stock.received.DLT` | `inventory.stock.received` |
| `inventory.reservation.expired.DLT` | `inventory.reservation.expired` |
| `fulfillment.order.shipped.DLT` | `fulfillment.order.shipped` |
| `fulfillment.order.cancelled.DLT` | `fulfillment.order.cancelled` |

### AckMode

모든 서비스의 `kafkaListenerContainerFactory`는 `AckMode.RECORD`를 사용한다.
성공 시 Spring Kafka가 자동으로 offset을 커밋하고, 실패 시 `DefaultErrorHandler`가 재시도 후 DLQ로 전송한다.
