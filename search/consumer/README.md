# search:consumer

Kafka 증분 색인 서비스.
`product.item.created`, `product.item.updated` 이벤트를 소비해 Elasticsearch에 실시간으로 색인한다.

## 포트: 8084

## 의존 인프라

| 인프라 | 용도 | 로컬 포트 |
|--------|------|-----------|
| Elasticsearch | 문서 색인 | 9200 |
| Kafka | 이벤트 소비 | 9092 |
| Eureka | 서비스 등록 | 8761 |

## 동작 방식

```
product.item.created / product.item.updated
        │ (Kafka)
        ▼
ProductIndexingConsumer
        │
        ▼
EsBulkDocumentProcessor (Dual BulkIngester)
  ├─ Primary: 5초 or 1000건마다 flush
  └─ Retry:   실패 시 3초 or 500건마다 재시도
        │
        ▼
Elasticsearch (products alias)
```

## 오류 처리

- `DefaultErrorHandler` + `ExponentialBackOff`: 1초 → 2초 → 4초 ... 최대 30초 재시도
- `MAX_POLL_RECORDS=50`: Kafka 배치 처리 크기 제한
- Consumer Group ID: `search-indexer`

## 로컬 실행

```bash
# Elasticsearch + Kafka 먼저 기동
docker compose -f docker/docker-compose.infra.yml up -d elasticsearch kafka zookeeper

./gradlew :search:consumer:bootRun
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ELASTICSEARCH_URIS` | `http://localhost:9200` | ES 주소 |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka 주소 |
| `EUREKA_DEFAULT_ZONE` | `http://localhost:8761/eureka/` | Eureka 주소 |

## 빌드

```bash
./gradlew :search:consumer:build
```
