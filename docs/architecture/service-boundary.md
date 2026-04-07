# Service Boundary

## 1. Discovery

### Responsibility
- Eureka 서비스 디스커버리
- 서비스 인스턴스 등록/해제/상태 관리

### Does NOT
- 비즈니스 로직 수행 금지
- DB 접근 금지

| 포트 | DB |
|------|-----|
| 8761 | - |

---

## 2. Gateway

### Responsibility
- API Gateway (라우팅)
- JWT 인증/인가
- Rate Limiting
- 요청 검증 및 외부 요청 표준화

### Does NOT
- 비즈니스 로직 수행 금지
- DB 접근 금지

| 포트 | DB |
|------|-----|
| 8080 | - |

---

## 3. Product Service

### Responsibility
- 상품 CRUD
- 상품 상태 관리
- 상품 도메인 규칙
- 재고 변경 이벤트 수신 시 상품 수량 동기화

### Data Ownership
- product_db 완전 소유

### Events
- 발행: `product.item.created`, `product.item.updated`
- 수신: `inventory.stock.reserved`, `inventory.stock.released`, `inventory.stock.received`

| 포트 | DB | 모듈 |
|------|-----|------|
| 8081 | product_db | product:domain / product:app |

---

## 4. Order Service

### Responsibility
- 주문 생성
- 주문 상태 전이
- 결제 연계 (외부 API)
- 재고 예약 만료 이벤트 수신

### Data Ownership
- order_db 완전 소유

### Events
- 발행: `order.order.completed`, `order.order.cancelled`
- 수신: `inventory.reservation.expired`

| 포트 | DB | 모듈 |
|------|-----|------|
| 8082 | order_db | order:domain / order:app |

---

## 5. Search Service

### Responsibility
- 검색 API 제공 (REST, 읽기 전용)
- Elasticsearch 인덱스 관리
- Kafka 이벤트 기반 증분 색인 (consumer)
- Spring Batch 전체 색인 (batch, alias swap)

### Data Ownership
- Elasticsearch 인덱스 소유
- RDBMS 미사용

### Events
- 수신: `product.item.created`, `product.item.updated`

| 포트 | DB | 모듈 |
|------|-----|------|
| 8083 (app) / 8084 (consumer) | Elasticsearch | search:domain / search:app / search:consumer / search:batch |

---

## 6. Inventory Service

### Responsibility
- 재고 관리 (SSOT: Single Source of Truth)
- 재고 예약/차감/해제
- Outbox 패턴으로 이벤트 발행

### Data Ownership
- inventory_db 완전 소유

### Events
- 발행: `inventory.stock.reserved`, `inventory.stock.released`, `inventory.stock.confirmed`, `inventory.stock.received`, `inventory.reservation.expired`
- 수신: `order.order.completed`, `order.order.cancelled`, `fulfillment.order.shipped`, `fulfillment.order.cancelled`

| 포트 | DB | 모듈 |
|------|-----|------|
| 8085 | inventory_db | inventory:domain / inventory:app |

---

## 7. Gifticon Service

### Responsibility
- 기프티콘 관리

### Data Ownership
- gifticon_db 완전 소유

| 포트 | DB | 모듈 |
|------|-----|------|
| 8086 | gifticon_db | gifticon:domain / gifticon:app |

---

## 8. Auth Service

### Responsibility
- OAuth2 인증 (카카오/구글)
- 사용자 인증 토큰 관리

### Data Ownership
- auth_db 완전 소유

| 포트 | DB | 모듈 |
|------|-----|------|
| 8087 | auth_db | auth:domain / auth:app |

---

## 9. Fulfillment Service

### Responsibility
- 출고 상태 관리 (상태 머신)
- Outbox 패턴으로 이벤트 발행

### Data Ownership
- fulfillment_db 완전 소유

### Events
- 발행: `fulfillment.order.created`, `fulfillment.order.shipped`, `fulfillment.order.delivered`, `fulfillment.order.cancelled`
- 수신: `inventory.stock.reserved`

| 포트 | DB | 모듈 |
|------|-----|------|
| 8088 | fulfillment_db | fulfillment:domain / fulfillment:app |

---

## 10. Code-Dictionary Service

### Responsibility
- 코드 사전 관리 (공통 코드 CRUD)

### Data Ownership
- code_dictionary_db 완전 소유

| 포트 | DB | 모듈 |
|------|-----|------|
| 8089 | code_dictionary_db | code-dictionary:domain / code-dictionary:app |

---

## 11. Warehouse Service

### Responsibility
- 창고 관리

### Data Ownership
- warehouse_db 완전 소유

| 포트 | DB | 모듈 |
|------|-----|------|
| 8090 | warehouse_db | warehouse:domain / warehouse:app |

---

## Data Ownership Rule

- 서비스 간 DB 공유 금지
- 데이터 변경은 이벤트 기반으로 전파 (Kafka, Outbox + CDC)
- 직접 조회가 필요한 경우 API 호출 (WebClient + CircuitBreaker + suspend)
