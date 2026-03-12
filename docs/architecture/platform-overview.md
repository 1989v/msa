# Platform Overview

## 1. System Context

본 플랫폼은 MSA 기반 커머스 시스템이다.

구성 서비스:

- Gateway
- Product
- Order
- Search
- Charting (주식 차트 패턴 유사도 분석 — ADR-001)
- Common (shared library module)

Infra:

- MySQL (service별 분리, master/replica)
- Redis (cluster 고려)
- Kafka (event-driven)
- Elasticsearch (Search 전용)
- PostgreSQL + pgvector (Charting 전용, port 5433 — ADR-002)

---

## 2. High-Level Service Diagram

[ Client ]
|
v
[ Gateway ]
|
+------------------+------------------+
|                  |                  |
v                  v                  v
[ Product ]    [ Order ]         [ Charting ]
|                  |                  |
v                  v                  v
[Product DB]   [Order DB]    [PostgreSQL+pgvector]
               |
               v
           [ Kafka ] ---> [ Search ]
                              |
                              v
                      [ Elasticsearch ]

각 서비스는 독립 DB를 가진다.
서비스 간 DB 직접 접근은 금지된다.

Charting 서비스는 커머스 도메인과 독립적으로 운영된다 (ADR-001).

---

## 3. Traffic Flow

### 3.1 Read Flow (상품 조회)

Client → Gateway → Product → DB (Replica)
|
v
Response

### 3.2 Order Flow (주문 생성)

Client → Gateway → Order → DB (Master)
|
v
Kafka Event Publish
|
v
Search (Index Update)

### 3.3 Search Flow

Client → Gateway → Search → Elasticsearch

---

## 4. Service Boundary Definition

- Gateway: 외부 진입점
- Product: 상품 도메인 소유
- Order: 주문 도메인 소유
- Search: 검색 전용 Read 모델
- Charting: 주식 차트 패턴 유사도 분석 및 수익률 예측 (ADR-001, ADR-003)
- Common: 공통 인프라/보안/유틸

각 서비스는 도메인 단위로 책임이 분리된다.

## 5. Charting Service Traffic Flow

### 5.1 일일 데이터 수집 (Scheduled)

APScheduler → YahooFinance/FinanceDataReader → ohlcv_bars (PostgreSQL)
→ FeatureExtractionPolicy → patterns.embedding (pgvector, HNSW)

### 5.2 유사 패턴 검색

Client → POST /api/v1/similarity → SearchSimilarPatternsUseCase
→ pgvector cosine similarity → top-20 패턴 → ForecastPolicy → Response