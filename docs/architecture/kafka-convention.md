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
| `search.impression.logged` | search | analytics | <!-- ADR-0043 -->
| `search.click.logged` | search | analytics | <!-- ADR-0043 -->
| `analytics.bandit.state.snapshot` | analytics | (선택) monitoring | <!-- ADR-0043 -->
| `analytics.score.updated` | analytics | search | <!-- ADR-0017 -->
| `analytics.event.collected` | (multi) | analytics | <!-- ADR-0017 -->
| `game.session.started` | game (code-dictionary:app 폴드) | analytics | <!-- ADR-0059 -->
| `game.session.ended` | game (code-dictionary:app 폴드) | analytics | <!-- ADR-0059 -->
| `game.ad.logged` | game — ads 페이즈에서 발행 예정 | analytics (예정) | <!-- ADR-0059 -->

Consumer groups (ADR-0043):
- `analytics-bandit-impression` (`search.impression.logged` 수신)
- `analytics-bandit-click` (`search.click.logged` 수신)

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
| `search.impression.logged.DLT` | `search.impression.logged` |
| `search.click.logged.DLT` | `search.click.logged` |

### AckMode

모든 서비스의 `kafkaListenerContainerFactory`는 `AckMode.RECORD`를 사용한다.
성공 시 Spring Kafka가 자동으로 offset을 커밋하고, 실패 시 `DefaultErrorHandler`가 재시도 후 DLQ로 전송한다.
