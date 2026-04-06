# Kafka Topic Convention

## 형식

`{domain}.{entity}.{event}`

## 토픽 목록

| 토픽 | 발행 서비스 | 수신 서비스 |
|------|------------|------------|
| `product.item.created` | product | search |
| `product.item.updated` | product | search |
| `order.order.completed` | order | - |
| `order.order.cancelled` | order | - |

## Consumer Group ID

형식: `{service}-{purpose}` (예: `search-indexer`)
