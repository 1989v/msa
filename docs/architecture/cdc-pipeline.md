# CDC 파이프라인 확장 가이드

## 개요

CDC(Change Data Capture)는 DB 바이너리 로그(binlog)를 실시간으로 읽어
변경 이벤트를 Kafka로 스트리밍하는 기법이다.
현재 search-batch의 DB 직접 리드 방식(ADR-0009)을 대체하거나 보완할 수 있다.

## 현재 아키텍처와의 비교

| 항목 | Kafka 애플리케이션 이벤트 (현재) | DB 직접 리드 (ADR-0009) | CDC (확장) |
|------|-------------------------------|------------------------|-----------|
| 데이터 완전성 | 코드 누락 시 이벤트 손실 가능 | DB 그대로 읽음 | DB 변경 전량 캡처 |
| 실시간성 | ms 단위 | 배치 스케줄 주기 | ms~초 단위 |
| 서비스 경계 | 준수 | 예외 허용 (ADR-0009) | 준수 (Kafka 경유) |
| 운영 복잡도 | 낮음 | 낮음 | 높음 (Kafka Connect 운영 필요) |
| 스키마 결합도 | 느슨 | 높음 (테이블 직접 참조) | 높음 (binlog 컬럼 참조) |

## 권장 도입 시점

- 상품 수가 수천만 건 이상으로 증가해 배치 색인 주기가 성능 병목이 될 때
- 실시간 검색 반영이 SLA 요구사항이 될 때 (현재는 Eventual Consistency 허용)
- Kafka Connect 인프라가 이미 운영되고 있을 때

## 구성 요소

```
MySQL (product_db) ──binlog──► Debezium MySQL Connector
                                      │ (Kafka Connect)
                                      ▼
                          Kafka Topic: dbz.commerce.products
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                 search-consumer           search-batch
              (실시간 증분 색인)         (초기/전체 색인 replay)
```

## Debezium MySQL Connector 설정 예시

`docker/kafka-connect/debezium-product-connector.json`:

```json
{
  "name": "product-mysql-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "tasks.max": "1",
    "database.hostname": "mysql-product-replica",
    "database.port": "3306",
    "database.user": "${PRODUCT_DB_USER}",
    "database.password": "${PRODUCT_DB_PASSWORD}",
    "database.server.id": "1001",
    "database.include.list": "product_db",
    "table.include.list": "product_db.products",
    "topic.prefix": "dbz",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:29092",
    "schema.history.internal.kafka.topic": "schema-changes.product",
    "include.schema.changes": "false",
    "snapshot.mode": "initial",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false",
    "transforms.unwrap.delete.handling.mode": "rewrite"
  }
}
```

## Kafka 토픽 이벤트 구조

Debezium이 발행하는 `dbz.commerce.products` 토픽 메시지 (`ExtractNewRecordState` 적용 후):

```json
{
  "id": 42,
  "name": "상품명",
  "price": 15000.00,
  "stock": 100,
  "status": "ACTIVE",
  "created_at": 1741478400000,
  "__deleted": "false"
}
```

`__deleted: "true"` 이면 ES에서 해당 문서 삭제 처리 필요.

## search-consumer 확장 방안

현재 `search-consumer`는 애플리케이션 이벤트(`product.item.created`, `product.item.updated`)를 처리한다.
CDC 이벤트를 처리하는 Consumer를 추가하거나, 기존 Consumer를 대체할 수 있다.

### 옵션 A: CDC Consumer 병행 운영
- `product.item.*` 토픽 (애플리케이션 이벤트) — 기존 유지
- `dbz.commerce.products` 토픽 (CDC) — 신규 Consumer 추가
- 장점: 점진적 마이그레이션 가능
- 단점: 중복 처리 가능성, Consumer 관리 복잡

### 옵션 B: CDC Consumer로 완전 교체
- 애플리케이션 이벤트 발행 코드 제거 (product 서비스 단순화)
- 단점: 운영 복잡도 증가 (Kafka Connect 인프라 추가 필요)

## 도입 전 필수 인프라

1. **Kafka Connect 클러스터** (`confluentinc/cp-kafka-connect` 또는 `debezium/connect`)
2. **MySQL binlog 활성화** (`my.cnf`: `log_bin=ON`, `binlog_format=ROW`, `binlog_row_image=FULL`)
3. **Debezium MySQL Connector 플러그인** (Kafka Connect에 설치)
4. **Schema Registry** (선택 사항, Avro 직렬화 사용 시)

MySQL binlog는 `mysql-product-master`에서만 활성화하면 된다 (replica는 master binlog를 복제).

## 구현 우선순위 제안

현재 단계에서는 다음 순서로 도입을 검토한다:

1. **현재 (완료)**: 애플리케이션 이벤트 기반 증분 색인 + API/DB 선택형 전체 색인 배치
2. **단기**: MySQL binlog 활성화 + Debezium 로컬 테스트 환경 구성
3. **중기**: search-consumer에 CDC 이벤트 처리 추가 (병행 운영, 옵션 A)
4. **장기**: 완전 CDC 전환 (Kafka Connect 운영 안정화 후, 옵션 B)
