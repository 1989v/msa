---
parent: 8-system-design
seq: 15
title: 분산 카운터 (광고 노출/클릭) 시스템 — System Design Card
type: scenario-card
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
catalog-row: "§3 시나리오 카드"
---

# 15. 분산 카운터 — 광고 노출/클릭 카운팅 시스템

> 10억 events / day, P99 (99th Percentile, 가장 느린 1%) < 100ms write. **정확도 vs latency vs 비용** 의 3각 trade-off 가 가장 노골적으로 드러나는 시나리오. "그냥 INCR 하면 되지 않나" 라고 하면 면접 컷.

---

## 1. Functional Requirements

1. **Impression count** — 광고 노출 (사용자에게 보임) 카운팅
2. **Click count** — 광고 클릭 카운팅
3. **Unique user count** — DAU (Daily Active Users) / 광고별 unique reach
4. **Aggregation by dimension** — 광고 ID / 광고주 / 캠페인 / 디바이스 / 지역 / 시간대
5. **CTR (Click-Through Rate, 클릭률) 계산** — clicks / impressions
6. **Real-time dashboard** — 광고주에게 1분 이내 노출/클릭 표시
7. **Billing integration** — 시간당 / 일별 정확한 카운트로 과금
8. **Fraud detection input** — 비정상 패턴 (같은 IP 폭주) 탐지용 raw event 보존

### Out of scope

- ML 기반 fraud 점수 (별도 서비스로 위임)
- RTB (Real-Time Bidding, 실시간 입찰)
- 광고 컨텐츠 저장 / 송출

---

## 2. NFR (Non-Functional Requirements)

| 항목 | 목표 | 비고 |
|---|---|---|
| Write QPS (Queries Per Second, 초당 쿼리 수) | 평균 12,000 / 피크 60,000 | 10억 events/day = 11,574 평균 |
| **Write P99 latency** | **< 100ms** | 광고 송출 직전 단계 — 차단 안됨 |
| Read latency (dashboard) | < 1초 (1분 freshness) | 광고주 UI |
| **Billing accuracy** | **±0.1%** | 과금 직결 |
| Real-time dashboard freshness | 1분 | trend 추적 |
| Unique count 정확도 | ±2% (HLL) | 정확한 unique 는 별도 batch |
| Hot retention | 7일 (raw event) | fraud 분석 |
| Cold retention | 2년 (집계) | 회계 / 감사 |
| Availability | 99.95% | write 손실 = 매출 손실 |

### Capacity / Sizing

```
events/day = 10억 (impression 9억 + click 1억)
평균 event = 200 byte (광고 ID, 사용자 ID, IP, UA, dimensions)
일 raw size = 200 GB (압축 전), 압축 후 60 GB

Kafka 보존 7일 = 60 × 7 = 420 GB → cluster 6 broker × 100GB = 600GB OK

ClickHouse:
  분 단위 집계 (광고 × 분 × 8 dimension) → ~1M row/min × 1440 = 1.4B row/day
  압축 후 100GB/day → 90일 = 9TB

HLL (HyperLogLog) 용량:
  광고당 ~14KB (precision 14)
  10만 광고 × 14KB = 1.4GB (하루 분, Redis)
```

---

## 3. High-Level Architecture

```
┌──────────────┐  impression/click  ┌──────────────┐
│ Ad Renderer  │───────────────────►│  Edge SDK    │ (browser/mobile beacon)
└──────────────┘                    └──────┬───────┘
                                           │ POST /event (batch 50)
                                           ▼
                              ┌─────────────────────────┐
                              │  Ingest Gateway         │
                              │  (rate limit + auth)    │
                              └────────────┬────────────┘
                                           │ async produce
                                           ▼
                              ┌─────────────────────────┐
                              │  Kafka                  │
                              │  ad.impression  (24 part)│
                              │  ad.click       (12 part)│
                              └────────┬─────────┬──────┘
                                       │         │
              ┌────────────────────────┘         └────────────┐
              ▼                                                ▼
   ┌──────────────────────┐                       ┌──────────────────────┐
   │ Real-time Aggregator │                       │  Raw Sink Worker     │
   │ (Kafka Streams)      │                       │  (Kafka → S3)        │
   │  - tumbling 1min     │                       │  Parquet, 7d hot     │
   │  - dimension cube    │                       │  + 2y cold (Glacier) │
   └──────────┬───────────┘                       └──────────────────────┘
              │
              ├──► Redis HLL (unique count)
              ├──► Redis Cluster (counter ZSet, hot top-N)
              └──► ClickHouse (column store, 분 단위 row)
                              │
                              ▼
                    ┌──────────────────┐
                    │ Dashboard API    │ (1분 cache)
                    │ Billing Job      │ (D+1 정산)
                    └──────────────────┘
```

---

## 4. Core Components

| 컴포넌트 | 역할 | 기술 선택 | 비고 |
|---|---|---|---|
| Edge SDK | 클라이언트 batch + retry | JS / iOS / Android | 50 event batch, 3s flush |
| Ingest Gateway | 인증 + rate limit + Kafka produce | Spring Boot WebFlux | non-blocking 필수 |
| Kafka | event broker | 6 broker × replica 3 | partition key = ad_id hash |
| Real-time Aggregator | 1분 tumbling 집계 | Kafka Streams + RocksDB | dimension cube 사전 계산 |
| Redis HLL | unique user 근사 | Redis 7 + HLL command | precision 14, 표준 오차 0.81% |
| Redis Counter | hot top-N + 누적 | Redis Cluster ZSet | INCR + ZINCRBY |
| ClickHouse | OLAP 집계 | Replicated MergeTree + TTL | 분 단위 row, 압축 10x |
| S3 + Parquet | raw event archive | Iceberg table 권장 | 회계/fraud 분석 |
| Billing Job | D+1 정확 카운트 | Spark / Flink batch | exactly-once via S3 raw |
| DLQ (Dead Letter Queue, 데드 레터 큐) | 실패 event 격리 | Kafka topic | 운영자 수동 처리 |

---

## 5. Data Model

### 5-1. Event schema (Kafka)

```avro
record AdImpressionEvent {
  string  event_id;           // ULID, idempotency key
  long    occurred_at;        // epoch millis (client clock)
  long    ingested_at;        // server timestamp
  string  ad_id;
  string  campaign_id;
  string  advertiser_id;
  string  user_id;            // hashed
  string  session_id;
  string  device_type;        // mobile / desktop / tablet
  string  geo_country;
  string  geo_region;
  string  publisher_id;
  int     viewport_pct;       // 0-100, viewability 보정
  long    duration_ms;        // 노출 시간
  string  client_ip_hash;     // PII 보호
  map<string, string> custom; // 자유 dimension
}
```

partition key: `ad_id` → 같은 광고는 같은 partition → consumer 가 dimension 집계 시 in-order.

### 5-2. ClickHouse 스키마

```sql
CREATE TABLE ad_events_1min ON CLUSTER ads
(
    minute_ts       DateTime,
    ad_id           String,
    campaign_id     String,
    advertiser_id   String,
    device_type     LowCardinality(String),
    geo_country     LowCardinality(String),
    publisher_id    String,
    impression_cnt  UInt64,
    click_cnt       UInt64,
    unique_users_hll AggregateFunction(uniq, String)
)
ENGINE = ReplicatedSummingMergeTree('/clickhouse/tables/{shard}/ad_events_1min', '{replica}',
    (impression_cnt, click_cnt))
PARTITION BY toYYYYMMDD(minute_ts)
ORDER BY (advertiser_id, ad_id, minute_ts)
TTL minute_ts + INTERVAL 90 DAY DELETE;

-- 시간 단위 rollup (자동 materialized view)
CREATE MATERIALIZED VIEW ad_events_1h_mv
ENGINE = ReplicatedSummingMergeTree(...)
AS SELECT
    toStartOfHour(minute_ts) AS hour_ts, ad_id, ...,
    sum(impression_cnt) AS imp, sum(click_cnt) AS clk
FROM ad_events_1min GROUP BY hour_ts, ad_id, ...;
```

### 5-3. Redis 자료구조

```
# 누적 카운트 (오늘)
INCRBY ad:imp:{ad_id}:{yyyymmdd} 1                      # ad 별 일 누적
ZINCRBY ad:imp:hot:{yyyymmdd} 1 {ad_id}                  # 인기 광고 ranking

# Unique user (HLL)
PFADD ad:uniq:{ad_id}:{yyyymmdd} {user_id}
PFCOUNT ad:uniq:{ad_id}:{yyyymmdd}                       # 근사 unique

# 1분 sliding (실시간 그래프)
ZADD ad:imp:ts:{ad_id} {minute_ts} {minute_ts}
ZREMRANGEBYSCORE ad:imp:ts:{ad_id} -inf {now-3600s}      # 1h 보존
```

---

## 6. Critical Decisions

### 6-1. **At-least-once vs Exactly-once delivery**

| 옵션 | 동작 | 비용 | 정확도 |
|---|---|---|---|
| At-most-once | producer fire-and-forget | 매우 낮음 | 손실 가능 |
| **At-least-once + idempotency ★** | producer retry + consumer event_id dedupe | 중간 | ±0.05% |
| Exactly-once (EOS) | Kafka transactional producer + read_committed | 높음 (latency 30%↑) | 100% |

**선택**: **At-least-once + event_id 기반 멱등 집계**.
- 1차: producer `acks=all + retries=Long.MAX + enable.idempotence=true` → 같은 partition 내 dedupe
- 2차: ClickHouse 집계는 SummingMergeTree 라 중복도 합산되지만, **event_id 별 첫 도착만 유효** 처리 위해 1분 윈도우 dedupe state store
- Billing 은 **D+1 batch (Spark over S3 raw)** 에서 event_id distinct count → 0.05% 이하 오차
- EOS 는 광고 latency budget (P99 100ms) 깬다 → 거절

### 6-2. **정확한 count vs HyperLogLog 근사**

| 옵션 | 메모리 | 정확도 | 용도 |
|---|---|---|---|
| Set (정확) | O(N) — 1M user × 64 byte = 64MB / ad | 100% | 광고 1개에만 OK |
| **HLL (HyperLogLog) ★** | 14KB (precision 14) | ±0.81% | 운영 metric, dashboard |
| Bloom filter | 비슷한 메모리 | exists check 만 | unique count 부적합 |
| Linear counting | 작음 | 작은 cardinality | 적용 범위 좁음 |

**선택**:
- **Real-time / dashboard / 운영 metric** → HLL (Redis PFCOUNT, ClickHouse uniqHLL12)
- **Billing / 정산** → S3 raw + Spark `COUNT(DISTINCT user_id)` 정확 계산 (D+1 OK)
- 두 path 분리 → SLA 다름

### 6-3. **샤딩/파티션 전략**

| 차원 | 옵션 | 선택 |
|---|---|---|
| Kafka partition key | ad_id / user_id / random | **ad_id** ★ — dimension 집계 in-order |
| Kafka partition 수 | 6 / 12 / 24 / 48 | 24 (impression) + 12 (click), 광고 hot key 대비 여유 |
| ClickHouse shard key | ad_id hash / advertiser_id | **advertiser_id** — query 가 보통 광고주 단위 |
| ClickHouse partition | day / hour | day (TTL 단위) |
| Redis cluster slot | ad_id hash | 16384 slot 자동 |

**Hot ad_id 함정**: 슈퍼볼급 광고 1건이 전체 트래픽 30% 차지 가능 → partition skew. 대응:
- partition key = `ad_id + (uniformHash(ts) % 4)` (sub-key 4분할)
- consumer side merge

### 6-4. **Sampling 전략**

| 옵션 | 비용 | 정확도 |
|---|---|---|
| Full ingestion (no sampling) | 100% | 100% |
| **Tiered ★** | impression 5%, click 100% | impression 통계 정확도 ±0.5% (큰 N) |
| Hashed sampling | hash(user_id) % 100 < 5 | unbiased |

**선택**: **Tiered + hashed**.
- **Click 은 절대 샘플링 X** (소수 + billing 직결)
- **Impression 은 광고당 1만 이상이면 5% 샘플링** (rare ad 는 100%)
- 결과: write QPS 1/4 감소 (12k → 3k)
- billing 은 raw 100% 보존 (S3 cold tier 만, ingestion path 영향 없음)

### 6-5. **Real-time vs Batch billing**

| 옵션 | 정확도 | latency | 광고주 신뢰 |
|---|---|---|---|
| Real-time billing (Streams) | ±2% | 1분 | 분쟁 많음 |
| **D+1 batch billing ★** | ±0.05% | 1일 | 산업 표준 |
| Hybrid (real-time estimate + D+1 정정) | 전망 ±2%, 청구 ±0.05% | 1분 / 1일 | 가장 깔끔 |

**선택**: **Hybrid** — 실시간 dashboard 는 estimate 라고 명시 (`(estimated)` label), 청구서는 D+1.

---

## 7. Failure Modes

| 장애 | 영향 | 대응 |
|---|---|---|
| **Edge SDK offline** | event 누락 | client-side persistent queue (IndexedDB / SQLite) + 24h retry |
| **Ingest gateway 다운** | write 실패 | client retry (exp backoff) + region failover |
| **Kafka broker 다운** | producer block | acks=all + min.insync.replicas=2 + 한 broker 다운 견딤 |
| **Kafka cluster 분단** | producer hang | client side circuit breaker → degrade to local queue |
| **Streams aggregator lag** | dashboard stale | RocksDB checkpoint + standby replica → 자동 failover |
| **Redis HLL 오버플로우** | unique count 부정확 | precision 14 (16384 register) 충분, 그래도 fallback ClickHouse uniqHLL12 |
| **ClickHouse insert lag** | dashboard 1-5분 stale | buffer engine + async insert |
| **Hot ad_id partition skew** | 1 partition lag | sub-key sharding + consumer auto-scale |
| **Bot / fraud 폭주** | 가짜 impression billing | rate limit per user/IP + fraud score (별도 ML) + billing 시 제외 |
| **Clock skew** (client time wrong) | minute bucket 잘못 | server `ingested_at` 으로 bucket 결정, `occurred_at` 은 보조 |
| **Duplicate event** | over-count | event_id dedupe (Streams state store) + S3 raw distinct |
| **Consumer rebalance storm** | 처리 멈춤 | static membership + cooperative-sticky assignor |
| **DLQ 적체** | event 손실 | retry topic 3단계 + 운영자 alert |

---

## 8. Scaling Path

### Phase 1 — 단일 broker + 단일 consumer (이벤트 < 100M / day)

```
[App] → [Kafka 3 broker] → [Spring Boot Consumer] → [MySQL counters table]
```
- INCR / UPDATE counter row by ad_id
- 단일 row hot key 위험 — ad_id × hour 로 row 분할

### Phase 2 — Kafka Streams + Redis (이벤트 1B / day)

```
[Edge SDK] → [Gateway] → [Kafka 12 part] → [Streams 1min] → [Redis + ClickHouse]
                                         → [S3 raw]
```
- ClickHouse 단일 cluster 3 shard
- Redis cluster 6 shard

### Phase 3 — Multi-region (이벤트 10B / day)

```
[Edge → 가까운 region Gateway] → [Regional Kafka] → [Streams]
                                                   ↓
                                             [Global ClickHouse cluster]
                                                   ↑
                                             cross-region replication
```
- Region 별 ingestion (latency 줄임)
- ClickHouse 는 single source (정산 일원화) — `_replicated` engine + zk
- Kafka MirrorMaker 2 로 region → 글로벌 cluster

### Phase 4 — Tiered sampling + Pre-aggregation

- Edge SDK 가 client-side aggregation (10초 윈도우 후 send) → server QPS 90% 감소
- precision 의도적 trade-off — billing 은 별도 path

---

## 9. Observability

### 핵심 metric

| metric | 임계값 | 알람 |
|---|---|---|
| `ingest.qps` | baseline ±20% | 이상 탐지 |
| `kafka.producer.error.rate` | > 0.1% | warning, > 1% critical |
| `kafka.consumer.lag.seconds` | > 60 | warning, > 300 critical |
| `streams.processing.latency.p99.ms` | > 500 | warning |
| `clickhouse.insert.latency.p99.ms` | > 1000 | warning |
| `redis.hll.error.rate` | > 1% | warning (precision 부족 의심) |
| `billing.discrepancy.pct` | > 0.1% | critical (회계 영향) |
| `dlq.size` | > 10000 | warning |
| `partition.skew.ratio` | > 3 | warning (hot ad) |

### 분산 트레이싱

- Sampling 0.01% (volume 큼)
- span: `ingest → kafka → streams → redis|clickhouse|s3`
- billing job 별도 trace

### Reconciliation

- 일별 cron: real-time count vs S3 raw distinct → discrepancy 보고
- threshold 0.1% 초과 시 자동 alert + 운영자 수동 검증
- (msa Payment 의 reconciliation 패턴 동일)

---

## 10. 면접 트랩

### Trap 1 — "그냥 Redis INCR 하면 되지 않나요?"

**Reality**:
- 10B/day = 평균 12k QPS, 피크 60k QPS → Redis 단일 instance 한계 (10만 ops/s 도 가능하지만 P99 변동)
- INCR 는 동기 → P99 100ms 내 보장 어려움
- Kafka 비동기 + downstream 집계 필수

### Trap 2 — "exactly-once 보장 안 되면 billing 부정확하지 않나요?"

**Reality**:
- 광고 산업 표준은 D+1 batch billing — real-time 은 estimate
- exactly-once Kafka EOS 는 latency 30% 페널티 + 광고주가 어차피 수용 안 함
- **At-least-once + S3 raw + D+1 distinct** 가 표준

### Trap 3 — "unique user 정확히 셀 수 있나요?"

**Reality**:
- 정확 unique 는 광고당 user_id Set 필요 → 메모리 폭발
- HLL 표준 오차 0.81% 면 dashboard 충분
- 정확 unique 는 D+1 batch 만

### Trap 4 — "한국 PG 사 같은 1원 mismatch 정책은 안 되나요?"

**Reality**:
- 광고는 PG (Payment Gateway) 와 다름 — 0.1% 미만 오차는 산업 표준
- IAB (Interactive Advertising Bureau) MRC 표준: ±5% 까지 허용
- 우리 ±0.05% 는 매우 엄격

### Trap 5 — "Hot ad 처리"

**Reality**:
- 슈퍼볼급 광고 1건이 30% 트래픽 → partition skew → consumer lag
- partition key = `ad_id + (random % N)` → sub-key 분할
- 소비자는 같은 ad_id 모든 sub-key 합산

### Trap 6 — "Sampling 하면 부정확하지 않나요?"

**Reality**:
- 큰 N (impression million 단위) 에서 5% sampling 도 통계적 ±0.5%
- 그러나 click 은 sample 금지 (수가 적고 billing 직결)
- 면접관이 "왜 click 만 100% 인가요?" 물으면 답변: "rare event 는 sampling 분산 큼 + billing 정확도"

### Trap 7 — "ClickHouse 대신 InfluxDB 는?"

**Reality**:
- InfluxDB 는 metric 시계열 (low cardinality) 에 강함
- 광고는 high-cardinality dimension (ad_id × user_id × ...) → ClickHouse / Druid 가 적합
- ClickHouse 는 SummingMergeTree 로 자동 rollup + JOIN 가능

### Trap 8 — "fraud detection 은?"

**Reality**:
- pipeline 입력만 제공 (이 시나리오 out of scope)
- 별도 ML 서비스 / Sift / 자체 모델 적용
- billing 은 fraud filter 통과 후 raw event 만 합산

### Trap 9 — "GDPR / 개인정보"

**Reality**:
- user_id 는 hashed (HMAC + salt rotation 90일)
- IP 는 마지막 옥텟 마스킹 (`192.168.1.0`)
- raw event 는 7-90일만 보존, cold tier 는 익명화

### Trap 10 — "광고주가 자기 광고 통계 더 fresh 하게 보고 싶다는데"

**Reality**:
- 1분 < freshness < 5분 trade-off
- Streams window 1분 + 1분 cache → 1-2분 lag
- 5초 freshness 는 비용 폭증 (window 작아지면 state store 부담)

---

## 11. msa 코드 grounding

본 msa 의 **analytics** 서비스가 정확히 이 패턴:

- `analytics/` — 이벤트 수집 → Kafka Streams + ClickHouse 라고 CLAUDE.md 명시
- `event-collector` 모듈이 Ingest Gateway 역할
- Kafka 토픽 컨벤션 (`docs/architecture/kafka-convention.md`) 그대로 적용
- ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012 (멱등성) → at-least-once 정합
- ADR-0015 (resilience) → CircuitBreaker + DLQ + Rate Limiting 적용
- ADR-0029 (idempotent consumer) → event_id dedupe 패턴

향후 본 시나리오 직접 구현 시 `analytics/event-collector` 와 `analytics/streams` 모듈을 그대로 활용하고, 광고 dimension 만 추가.

---

## 12. 30초 면접 요약

> "Distributed counter (광고 impressions/clicks) 는 10B events/day, P99 < 100ms write. 핵심은 (1) write path 는 Kafka 비동기 (acks=all + idempotent producer) → 광고 송출 latency 차단 안됨, (2) 두 path 분리 — real-time (Streams 1min + Redis HLL + ClickHouse, 정확도 ±2%) vs billing (S3 raw Parquet + D+1 Spark distinct, ±0.05%), (3) at-least-once + event_id 멱등 — EOS (Exactly-Once Semantics) 는 latency budget 깸, (4) HLL (HyperLogLog) precision 14 로 unique 근사 ±0.81%, (5) Hot ad partition skew 는 sub-key sharding (ad_id + random % N), (6) impression 5% sampling + click 100%. msa analytics 서비스가 그대로 이 패턴."

---

## 부록 A. 흔한 함정

1. **단일 INCR 동기 호출** — 부하 폭증, P99 깨짐 → Kafka 비동기
2. **exactly-once 강제** — latency 30% 페널티, 광고 산업 비표준
3. **unique = COUNT(DISTINCT)** — 메모리 폭발 → HLL 근사 + D+1 정확
4. **partition key = random** — dimension 집계 in-order 깨짐 → ad_id
5. **client time 신뢰** — clock skew 로 minute bucket 잘못 → server `ingested_at`
6. **HLL 만 쓰고 raw 안 보존** — billing 분쟁 시 증거 없음 → S3 raw 90일+
7. **Sampling 광고 단위 적용 안 함** — rare ad 도 sampling 되면 0 카운트 → 광고당 threshold 적용
8. **ClickHouse 단일 row insert** — 부하 폭증 → batch insert (Buffer engine)
9. **bot fraud 무방비** — 가짜 impression 청구 → rate limit + fraud score (out of scope but interface 필요)
10. **DLQ 모니터링 안 함** — 일부 event 영구 손실 → DLQ 크기 alert + 운영자 처리 SOP
