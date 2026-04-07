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
| `inventory.stock.reserved` | inventory | fulfillment |
| `inventory.stock.released` | inventory | - |
| `inventory.stock.confirmed` | inventory | - |
| `inventory.reservation.expired` | inventory | order |
| `fulfillment.order.created` | fulfillment | - |
| `fulfillment.order.shipped` | fulfillment | inventory |
| `fulfillment.order.delivered` | fulfillment | - |
| `fulfillment.order.cancelled` | fulfillment | inventory |

## Consumer Group ID

형식: `{service}-{purpose}` (예: `search-indexer`, `inventory-service`, `fulfillment-service`)
