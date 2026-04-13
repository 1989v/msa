# 3. Data Platform

> 6종 데이터베이스 + Kafka Streams + CDC 파이프라인으로 구성된 다층 데이터 아키텍처

---

## Multi-Database Strategy

용도에 최적화된 DB를 서비스별로 선택. 단일 DB에 모든 워크로드를 집어넣지 않음.

| DB | 용도 | 서비스 | 특징 |
|----|------|--------|------|
| **MySQL 8.0** | OLTP (트랜잭션) | product, order, auth, member, inventory, fulfillment, gifticon, wishlist, warehouse, chatbot, experiment, code-dictionary | Master/Replica, Flyway |
| **Elasticsearch 8.17** | Full-text Search | search | Nori 한국어 분석기, BulkProcessor |
| **OpenSearch 2.19** | Hybrid Search | code-dictionary | BM25 + 동의어, edge-ngram 자동완성 |
| **ClickHouse** | OLAP (분석) | analytics | 컬럼 기반, 1시간 tumbling window 집계 |
| **PostgreSQL + pgvector** | Vector Similarity | charting | HNSW 인덱스, 32차원 임베딩 |
| **Redis Cluster** | Cache / Lock / Session / Read Model | gateway, product, analytics, experiment, gifticon | 슬롯 기반 키 설계 |

**근거**: `docs/adr/ADR-0006-database-strategy.md`

---

## Service-per-DB 격리

```
Product Service ──→ product_db (Master) ←──→ product_db (Replica)
Order Service   ──→ order_db (Master)   ←──→ order_db (Replica)
Auth Service    ──→ auth_db (Master)    ←──→ auth_db (Replica)
...
```

- **DB 공유 금지**: 서비스 간 cross-schema 접근 불허
- **Master/Replica**: `AbstractRoutingDataSource`로 `@Transactional(readOnly=true)` → Replica 자동 라우팅
- **예외**: 강일관성 필요 시 Master 강제 (Optimistic Lock 등)

**코드 위치**: 각 서비스의 `infrastructure/config/DataSourceConfig.kt`

---

## Redis 키 설계

| 용도 | 키 패턴 | TTL | 서비스 |
|------|--------|-----|--------|
| Cache | `cache:{service}:{entity}:{id}` | 5분 | product, order |
| Session | `session:refresh:{userId}` | 7일 | auth |
| Blacklist | `blacklist:{token}` | 토큰 만료시까지 | auth, gateway |
| Lock | `lock:{resource}:{id}` | 30초 | inventory |
| Read Model | `inventory:read:{productId}` | 없음 (이벤트 갱신) | inventory |
| Rate Limit | `rate:{userId/ip}` | 1초 | gateway |
| Score Cache | `score:{productId}` | 이벤트 갱신 | analytics |

**코드 위치**: `docs/adr/ADR-0007-cache-strategy.md` · `common/src/.../config/`

---

## Kafka 이벤트 아키텍처

### 토픽 네이밍 컨벤션

```
{domain}.{aggregate}.{event}
```

| 토픽 | Publisher | Consumer(s) |
|------|----------|-------------|
| `product.item.created` | product | search-indexer |
| `product.item.updated` | product | search-indexer |
| `order.order.completed` | order | inventory |
| `order.order.cancelled` | order | inventory |
| `inventory.stock.reserved` | inventory | fulfillment, product |
| `inventory.stock.released` | inventory | fulfillment, product |
| `inventory.stock.confirmed` | inventory | product |
| `fulfillment.order.shipped` | fulfillment | inventory |
| `analytics.events` | gateway, services | analytics (Kafka Streams) |
| `analytics.score.updated` | analytics | search-consumer |

**Consumer Group**: `{service}-{purpose}` (예: `search-indexer`, `inventory-service`)

**근거**: `docs/architecture/kafka-convention.md`

---

## Kafka Streams 실시간 집계 (Analytics)

ClickHouse OLAP + Kafka Streams로 실시간 사용자 행동 분석 & 상품 스코어 산출.

```
analytics.events (Kafka)
    ↓
Kafka Streams (1h tumbling window)
    ├─ 조회수, 클릭수, 구매 전환율 집계
    ├─ ClickHouse INSERT (OLAP 저장)
    └─ Redis score:{productId} 갱신
            ↓
    analytics.score.updated (Kafka)
            ↓
    search-consumer → ES score 필드 업데이트
```

**코드 위치**:
- Streams 처리: `analytics/app/src/.../infrastructure/messaging/`
- ClickHouse 저장: `analytics/app/src/.../infrastructure/persistence/`
- Score 발행: `analytics/app/src/.../infrastructure/messaging/`

**근거**: `docs/adr/ADR-0017-analytics-scoring.md`

---

## CDC Pipeline (Change Data Capture)

### Phase 1: Polling Publisher (현재)

```kotlin
@Scheduled(fixedDelay = 1000)
fun publishPendingEvents() {
    val events = outboxRepository.findByStatus(PENDING)
    events.forEach { event ->
        kafkaTemplate.send(event.topic, event.key, event.payload)
        event.markPublished()
    }
}
```

### Phase 2: Debezium CDC (계획)

```
MySQL binlog → Debezium Connector → Kafka
                                      ↓
                              Outbox 테이블 변경을
                              실시간 이벤트로 변환
```

- Polling 대비 지연 시간 수십ms → 수ms로 개선
- 아웃박스 테이블 폴링 부하 제거

**근거**: `docs/architecture/cdc-pipeline.md` · `docs/adr/ADR-0011`

---

## Search Pipeline (3-Module Architecture)

Search 서비스는 역할별 3개 모듈로 분리:

```
search/
├── app/          # REST API (조회 전용)
├── consumer/     # Kafka Consumer (실시간 색인)
└── batch/        # Spring Batch (전체 재색인)
```

| 모듈 | 입력 | 출력 | 용도 |
|------|------|------|------|
| app | HTTP 요청 | Elasticsearch 쿼리 결과 | 상품 검색 API |
| consumer | Kafka 이벤트 | ES bulk index | 실시간 변경 반영 |
| batch | product_db Replica | ES full reindex | 정기 전체 동기화 |

**Elasticsearch 설정**:
- Nori 한국어 분석기 (형태소 분석)
- BulkProcessor (배치 색인 최적화)
- Index alias (`products`) 로 무중단 재색인

**근거**: `docs/adr/ADR-0008` · `docs/adr/ADR-0009`

---

## Vector Similarity Search (Charting)

주가 차트 패턴을 **32차원 벡터**로 임베딩하여 유사 패턴 검색.

```python
# PostgreSQL + pgvector
class ChartEmbedding(Base):
    embedding = Column(Vector(32))  # 32-dim normalized vector

# HNSW 인덱스 (근사 최근접 이웃)
Index('ix_embedding_hnsw', ChartEmbedding.embedding,
      postgresql_using='hnsw',
      postgresql_ops={'embedding': 'vector_cosine_ops'})
```

- 60일 슬라이딩 윈도우로 패턴 추출
- Cosine similarity로 유사 패턴 매칭
- 미래 수익률 예측 (+5일, +20일, +60일)

**코드 위치**: `charting/src/` (Python/FastAPI)

---

## Schema Migration (Flyway)

- 서비스별 독립 마이그레이션 (`{service}/app/src/main/resources/db/migration/`)
- SQL 기반 (Kotlin DSL 미사용)
- 버전 관리: `V{number}__{description}.sql`
- 로컬 K8s에서는 `ddl-auto: update`로 smoke test (overlay 패치)

---

## Backup & Disaster Recovery

| 항목 | 전략 | 주기 |
|------|------|------|
| Full Backup | Percona XtraBackup | 매일 02:00 |
| Binlog Archive | MySQL binlog 아카이브 | 매시간 |
| 파일 백업 | rsync (기프티콘 이미지 등) | 매일 02:00 |
| RPO | ~0 (binlog 연속 아카이브) | - |
| RTO | 수분 (XtraBackup 복원 + binlog replay) | - |
| 보관 | Full: 7일, Binlog: 2일 | - |

**코드 위치**:
- 스크립트 (source of truth): `docker/backup/scripts/`
- K8s CronJob: `k8s/infra/prod/backup/`
- 스토리지 플러그인: `docker/backup/storage-providers/` (S3/GCS/Local)

**복구 명령**:
```bash
# Full restore
restore-mysql.sh --db product_db --date 2026-04-05

# Point-in-Time Recovery
restore-mysql.sh --db product_db --date 2026-04-05 --pitr "2026-04-06 10:30:00"
```

---

*Code references: `docs/adr/ADR-0006` · `ADR-0007` · `ADR-0008` · `ADR-0009` · `ADR-0011` · `ADR-0017` · `docs/architecture/kafka-convention.md`*
