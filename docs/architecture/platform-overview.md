# Platform Overview

## 1. System Context

본 플랫폼은 MSA 기반 커머스 시스템이다.

### 서비스 목록 (2026-04-07 기준)

| 서비스 | 모듈 | DB | 포트 | 역할 |
|--------|------|-----|------|------|
| discovery | discovery | - | 8761 | Eureka 서비스 디스커버리 |
| gateway | gateway | - | 8080 | API Gateway + JWT 인증 + Rate Limiting |
| product | product:domain/app | product_db | 8081 | 상품 카탈로그 CRUD + 이벤트 발행 |
| order | order:domain/app | order_db | 8082 | 주문 + 결제 연동 + 이벤트 발행 |
| search | search:domain/app/consumer/batch | Elasticsearch | 8083/8084 | 상품 검색 (Elasticsearch) |
| inventory | inventory:domain/app | inventory_db | 8085 | 재고 관리 (SSOT) + Outbox |
| gifticon | gifticon:domain/app | gifticon_db | 8086 | 기프티콘 관리 |
| auth | auth:domain/app | auth_db | 8087 | OAuth2 인증 (카카오/구글) |
| fulfillment | fulfillment:domain/app | fulfillment_db | 8088 | 출고 상태 관리 + Outbox |
| code-dictionary | code-dictionary:domain/app | code_dictionary_db | 8089 | 코드 사전 |
| warehouse | warehouse:domain/app | warehouse_db | 8090 | 창고 관리 |

### Shared Module

- common: 공통 라이브러리 (Exception, ApiResponse, Security, Redis, WebClient 등)

### Infra

- MySQL (서비스별 분리, master/replica)
- Redis (cluster 고려)
- Kafka (event-driven)
- Elasticsearch (Search 전용)

---

## 2. High-Level Service Diagram

```
                          [ Client ]
                              |
                              v
                         [ Gateway ]
                              |
        +----------+----------+----------+----------+
        |          |          |          |          |
        v          v          v          v          v
  [ Product ] [ Order ] [ Inventory ] [ Auth ] [ Warehouse ]
        |          |          |                     |
        v          v          v                     v
  [product_db] [order_db] [inventory_db]      [warehouse_db]
        |          |          |
        +-----+----+----+----+----------+
              |              |           |
              v              v           v
          [ Kafka ] ---> [ Search ] [ Fulfillment ] [ Gifticon ] [ Code-Dictionary ]
                              |          |               |              |
                              v          v               v              v
                       [Elasticsearch] [fulfillment_db] [gifticon_db] [code_dictionary_db]
```

각 서비스는 독립 DB를 가진다.
서비스 간 DB 직접 접근은 금지된다.

---

## 3. Traffic Flow

### 3.1 Read Flow (상품 조회)

Client -> Gateway -> Product -> DB (Replica)

### 3.2 Order Flow (주문 생성)

```
Client -> Gateway -> Order -> DB (Master)
                       |
                       v
               Kafka Event Publish (order.order.completed)
                       |
                       v
               Inventory (재고 차감) -> Kafka (inventory.stock.reserved)
                       |
              +--------+--------+
              |                 |
              v                 v
        Fulfillment       Product (수량 동기화)
        (출고 생성)
```

### 3.3 Search Flow

Client -> Gateway -> Search -> Elasticsearch

### 3.4 Index Update Flow (이벤트 기반)

```
Product -> Kafka (product.item.created/updated) -> Search Consumer -> Elasticsearch
```

---

## 4. Service Boundary Definition

- **Discovery**: 서비스 레지스트리
- **Gateway**: 외부 진입점, 인증/인가, Rate Limiting
- **Product**: 상품 도메인 소유
- **Order**: 주문 도메인 소유
- **Search**: 검색 전용 Read 모델
- **Inventory**: 재고 도메인 소유 (SSOT)
- **Fulfillment**: 출고/배송 도메인 소유
- **Auth**: 인증/인가 도메인 소유
- **Gifticon**: 기프티콘 도메인 소유
- **Code-Dictionary**: 공통 코드 도메인 소유
- **Warehouse**: 창고 도메인 소유
- **Common**: 공통 인프라/보안/유틸 (라이브러리 모듈)

각 서비스는 도메인 단위로 책임이 분리된다.

---

## 5. Data Protection & Disaster Recovery

### 5.1 백업 전략

- **MySQL**: Percona XtraBackup 풀백업 (매일 02:00) + Binlog PITR (매 시간 아카이브)
- **File Storage**: rsync (gifticon 이미지, 매일 02:00)
- **스토리지**: S3/GCS/Local 플러그인 방식 (STORAGE_PROVIDER 환경변수)

### 5.2 RPO / RTO

| 목표 | 수준 | 방법 |
|------|------|------|
| RPO | ~0 | Binlog 연속 보관으로 마지막 트랜잭션까지 복구 |
| RTO | 수 분 | XtraBackup 복원 + binlog replay |

### 5.3 보관 정책

| 대상 | 보관 기간 |
|------|-----------|
| 풀백업 (MySQL, Files) | 7일 |
| Binlog | 2일 |

### 5.4 자동 페일오버 (비활성)

Orchestrator + ProxySQL 기반. `docker/backup/ha/` 에 설정 포함, 필요 시 활성화.

상세: `docker/backup/README.md`
