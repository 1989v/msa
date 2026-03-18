# Kafka Topic Convention

## Naming Format

```
{domain}.{entity}.{event}
```

## Topic Registry

| Topic | Publisher | Consumer | Description |
|-------|----------|----------|-------------|
| `product.item.created` | product | search-consumer | 상품 생성 이벤트 |
| `product.item.updated` | product | search-consumer | 상품 수정 이벤트 |
| `order.order.completed` | order | - | 주문 완료 이벤트 |
| `order.order.cancelled` | order | - | 주문 취소 이벤트 |

## Consumer Group Naming

Format: `{service}-{purpose}`

| Consumer Group ID | Service | Purpose |
|-------------------|---------|---------|
| `search-indexer` | search-consumer | ES 증분 색인 |

## DLQ (Dead Letter Queue)

- 설계는 ADR-0009 참조 (추후 결정)
- DLQ 토픽 naming 예시: `{original-topic}.dlq`

## CDC Topics (Future - see docs/architecture/cdc-pipeline.md)

CDC 도입 시 Debezium 토픽:
- `dbz.commerce.products` (product_db binlog 기반)
