---
parent: 8-system-design
seq: 17
title: IoT 텔레메트리 수집·처리 파이프라인 — System Design Card
type: scenario-card
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
catalog-row: "§3 시나리오 카드"
---

# 17. IoT 텔레메트리 수집·처리 파이프라인

> 100만 device, 초당 10만 message. 1년 hot retention + 5년 cold. **MQTT vs gRPC, Kafka 인입 패턴, 시계열 압축, 비용 최적화 (cold tier)** 가 핵심. 광고 카운터 (#15) 와는 다른 결 — 디바이스 offline window, clock skew, schema evolution 함정이 풍부하다.

---

## 1. Functional Requirements

1. **디바이스 등록 / 인증** — TLS (Transport Layer Security, 전송 계층 보안) mutual auth (mTLS) 또는 토큰
2. **Telemetry 수집** — 센서 값 (온도, 습도, 배터리, GPS 등) 주기적 송신
3. **Command (downstream)** — 서버에서 디바이스로 명령 (재부팅, 설정 변경)
4. **Real-time monitoring** — dashboard 1-5초 freshness
5. **Time-series query** — "device X 의 지난 1시간 온도" 등
6. **Alert / Anomaly detection** — 임계값 기반 또는 ML
7. **Schema evolution** — 디바이스 펌웨어 업데이트로 새 필드 추가
8. **Long-term archive** — 5년 cold storage (회계, 분석, 컴플라이언스)
9. **Device shadow** — 마지막 알려진 상태 (오프라인이어도 last value 조회)

### Out of scope

- 디바이스 OTA (Over-The-Air) firmware update
- 디바이스 GUI / mobile app
- ML 모델 training (별도 pipeline)

---

## 2. NFR (Non-Functional Requirements)

| 항목 | 목표 | 비고 |
|---|---|---|
| Connected devices | 1,000,000 동시 | MQTT broker capacity |
| Message ingestion | 100,000 msg/s 평균, 300,000 peak | 디바이스당 평균 10s 주기 + burst |
| Avg message size | 200 byte | JSON / Protobuf, 배터리 친화 |
| **Ingestion P99 latency** | **< 200ms** (device → broker) | low-power device 라 짧을수록 좋음 |
| Dashboard freshness | 1-5초 | real-time 모니터링 |
| Hot retention | 1년 (rich query) | TimescaleDB / ClickHouse |
| Cold retention | 5년 (archive) | S3 + Glacier |
| Availability | 99.9% (broker), 99.95% (query) | 디바이스 offline 견딤 |
| Durability | event 손실 < 0.01% | health-critical 디바이스는 별도 |
| Cost | < $0.001 per 1k messages | 100M msg/day = $100/day budget |

### Capacity / Sizing

```
디바이스: 1M
평균 message rate: 디바이스당 0.1 msg/s (10s 주기) → 100,000 msg/s
peak: 300,000 msg/s (재연결 / firmware update / 동시 boot)

일 message: 100k × 86,400 = 8.64B msg/day
일 raw size: 8.64B × 200 byte = 1.73 TB/day (압축 전)
압축 후 (Parquet zstd): 200 GB/day

1년 hot:
  ClickHouse / TimescaleDB 200GB × 365 = 73 TB
  압축 + columnar = ~30 TB 실제 storage

5년 cold:
  S3 Standard: $23 per TB/month
  S3 Glacier Deep Archive: $1 per TB/month
  → 730 TB × $1 = $730/month (Glacier)

MQTT broker:
  1M concurrent connection → broker cluster 10 instance × 100k connection
  CPU bound: encryption (TLS) + keep-alive
```

---

## 3. High-Level Architecture

```
┌────────────┐  MQTT pub  ┌──────────────────┐
│ IoT Device │──TLS 8883─►│ MQTT Broker      │ (EMQX / HiveMQ / VerneMQ)
└────────────┘            │ - 1M conn cluster│
       ▲                  │ - 10 broker      │
       │ command          └────────┬─────────┘
       │ (subscribe)                │ bridge to Kafka
       │                            ▼
                          ┌──────────────────┐
                          │  Kafka           │
                          │  iot.telemetry   │ (60 partition)
                          │  iot.command     │ (12)
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────────┐
              ▼                    ▼                        ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐
   │ Stream Processor │  │ Hot Sink Worker  │  │ Cold Sink Worker   │
   │ (Flink / Streams)│  │ → ClickHouse /   │  │ → S3 Parquet hourly│
   │ - downsampling   │  │   TimescaleDB    │  │ → Glacier 30d 후    │
   │ - alert rules    │  └──────────────────┘  └────────────────────┘
   │ - window agg     │
   └────────┬─────────┘
            │
            ├──► Redis (device shadow, last value)
            ├──► Alert dispatcher (notification system)
            └──► Anomaly detector (별도 ML 서비스 입력)

┌──────────────────┐
│ Query / Dashboard│ ──► Hot tier (sub-second)
│ Service          │ ──► Cold tier (athena / Spark, 분 단위)
└──────────────────┘
```

---

## 4. Core Components

| 컴포넌트 | 역할 | 기술 선택 | 비고 |
|---|---|---|---|
| MQTT Broker | 디바이스 연결 + pub/sub | EMQX / HiveMQ / VerneMQ | QoS (Quality of Service) 0/1/2 지원 |
| Kafka Bridge | MQTT → Kafka | EMQX 내장 또는 Kafka Connect | partition key = device_id |
| Schema Registry | Avro / Protobuf 진화 관리 | Confluent Schema Registry | 호환성 강제 |
| Stream Processor | 실시간 집계 + alert | Flink (CEP) / Kafka Streams | window 1-5s |
| Hot Storage | 1년 시계열 저장 | TimescaleDB or ClickHouse | hyper-table / MergeTree |
| Cold Storage | 5년 archive | S3 Standard → Glacier | hourly Parquet |
| Device Shadow | 마지막 상태 캐시 | Redis Hash | TTL 7일 (재연결 시 갱신) |
| Query API | dashboard / app | Spring Boot + Reactor | hot + cold federation |
| Auth Service | 디바이스 인증 | mTLS + 토큰 | cert rotation 90일 |
| Alert Dispatcher | 임계값 알람 | reuse 07-notification | webhook / push |
| Cold Query | archive 검색 | AWS Athena / Spark | analyst on-demand |

---

## 5. Data Model

### 5-1. Telemetry message (Protobuf)

```protobuf
syntax = "proto3";

message TelemetryV1 {
  string  device_id     = 1;
  int64   ts_device     = 2;   // device clock (millis)
  int64   ts_ingested   = 3;   // server (broker) clock — 신뢰 source
  string  firmware_ver  = 4;
  Sensor  sensor        = 5;
  optional bytes signature = 99; // optional HMAC for tamper detect
}

message Sensor {
  optional float temperature_c   = 1;
  optional float humidity_pct    = 2;
  optional float battery_pct     = 3;
  optional GeoPoint location     = 4;
  map<string, string> custom     = 99; // 펌웨어별 자유 필드
}

message GeoPoint {
  double lat = 1;
  double lon = 2;
  optional float accuracy_m = 3;
}
```

**Schema evolution 원칙**:
- 새 필드는 항상 `optional` + 새 tag 번호
- 기존 tag 재사용 금지 (deleted reserved)
- enum 은 `UNKNOWN = 0` 항상 남김
- backward + forward compatible (Confluent Registry 강제)

### 5-2. Hot storage (TimescaleDB hyper-table)

```sql
CREATE TABLE telemetry (
    ts             TIMESTAMPTZ  NOT NULL,        -- ingested_ts (서버 시간)
    device_id      TEXT         NOT NULL,
    firmware_ver   TEXT,
    temperature_c  REAL,
    humidity_pct   REAL,
    battery_pct    REAL,
    location       GEOGRAPHY(POINT, 4326),
    custom         JSONB
);

SELECT create_hypertable('telemetry', 'ts',
    chunk_time_interval => INTERVAL '1 day',
    partitioning_column => 'device_id', number_partitions => 16);

CREATE INDEX ON telemetry (device_id, ts DESC);

-- 압축 (1주 후 자동)
ALTER TABLE telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'ts DESC'
);
SELECT add_compression_policy('telemetry', INTERVAL '7 days');

-- TTL (Time To Live, 생존 시간) 1년
SELECT add_retention_policy('telemetry', INTERVAL '365 days');

-- continuous aggregate (1분 평균)
CREATE MATERIALIZED VIEW telemetry_1min
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 minute', ts) AS bucket,
       device_id,
       AVG(temperature_c) AS temp_avg,
       AVG(humidity_pct) AS hum_avg,
       MIN(battery_pct) AS bat_min,
       COUNT(*) AS sample_count
FROM telemetry GROUP BY bucket, device_id;
```

### 5-3. ClickHouse 대안 (write 폭주 시 더 강함)

```sql
CREATE TABLE telemetry ON CLUSTER iot
(
    ts             DateTime64(3),
    device_id      LowCardinality(String),
    firmware_ver   LowCardinality(String),
    temperature_c  Float32     CODEC(Gorilla, ZSTD),
    humidity_pct   Float32     CODEC(Gorilla, ZSTD),
    battery_pct    Float32     CODEC(Gorilla, ZSTD),
    lat            Float64     CODEC(Gorilla, ZSTD),
    lon            Float64     CODEC(Gorilla, ZSTD)
)
ENGINE = ReplicatedMergeTree('/clickhouse/{shard}/telemetry', '{replica}')
PARTITION BY toYYYYMMDD(ts)
ORDER BY (device_id, ts)
TTL ts + INTERVAL 365 DAY TO VOLUME 'cold',
    ts + INTERVAL 365 DAY DELETE;
```

`Gorilla` codec 은 시계열 float 압축에 특화 (Facebook 발), 일반적으로 10x 압축률.

### 5-4. Device Shadow (Redis)

```
HSET shadow:{device_id} \
  last_ts 1715846400000 \
  temperature 23.5 \
  battery 87 \
  firmware "1.2.3" \
  online "true"
EXPIRE shadow:{device_id} 604800   # 7d
```

오프라인 디바이스도 마지막 상태 즉시 조회 가능.

### 5-5. Cold storage (S3 Parquet)

```
s3://iot-archive/
  year=2026/month=05/day=05/hour=14/
    device_partition=00/  ← device_id hash % 16
      part-00000.parquet  (zstd, ~50MB)
      part-00001.parquet
    device_partition=01/
      ...
```

Hourly batch (Streams `iot.telemetry-archived` topic → S3 sink connector 또는 자체 worker).
Iceberg / Delta 테이블 옵션 — 분석 편의 + 시간 진화 가능.

---

## 6. Critical Decisions

### 6-1. **Protocol: MQTT vs gRPC vs HTTP**

| 옵션 | 장점 | 단점 | 적합 |
|---|---|---|---|
| **MQTT (1.x / 5.0) ★** | 저전력, persistent connection, QoS 0/1/2, last will, retain | broker 운영 부담 | low-power IoT 표준 |
| gRPC streaming | HTTP/2 multiplex, schema first (Protobuf) | 전력 소모 (HTTP/2 ping), TCP 친화 안됨 | edge gateway / 풍부 디바이스 |
| HTTP POST batch | 가장 단순 | overhead 큼, 전력 ↑ | 저빈도 디바이스 |
| CoAP | UDP 기반, 초저전력 | 신뢰성 약함, 생태계 작음 | constrained device 만 |

**선택**: **MQTT 5.0 기본** + edge gateway 가 있는 케이스만 gRPC.
- MQTT 5.0 → message expiry, reason code, shared subscription 등 production-grade
- QoS 1 (at-least-once) 표준 — QoS 2 는 latency 크고 broker 부담
- 1M concurrent connection 은 EMQX cluster 가 검증됨 (10 broker 노드)

### 6-2. **Batch interval — Device 측 batching**

| 전략 | latency | 전력 | 적합 |
|---|---|---|---|
| 매 sample 즉시 | 1초 | 높음 | health-critical (의료) |
| **10초 주기 + immediate alert ★** | 10초 (alert 즉시) | 중간 | 일반 IoT |
| 1분 batch | 1분 | 낮음 | 환경 센서 |
| event-driven | 변동 시만 | 가장 낮음 | smart home |

**선택**: **Hybrid** — 정상 sample 은 10초 주기 batching, 이상치는 immediate (low-power 와 latency 절충).

### 6-3. **Schema evolution 강제 정책**

Schema Registry 호환성 모드 4가지:

| 모드 | producer 변경 | consumer 변경 |
|---|---|---|
| BACKWARD | 새 schema 가 옛 data 읽기 가능 | consumer 먼저 update |
| FORWARD | 옛 schema 가 새 data 읽기 가능 | producer 먼저 update |
| **FULL ★** | 양방향 | 어느 쪽 먼저든 OK |
| NONE | 강제 없음 | 위험 |

**선택**: **FULL** 강제. 특히 디바이스 펌웨어는 OTA update 가 점진적이라 일부 디바이스는 옛 schema 로 보내고 일부는 새 schema → bidirectional 호환 필수.

### 6-4. **Hot storage: TimescaleDB vs ClickHouse vs InfluxDB**

| DB | 장점 | 단점 | 추천 |
|---|---|---|---|
| **TimescaleDB ★** (write < 100k/s) | PostgreSQL 친화, JOIN 강함, continuous aggregate | write 한계 (~100k/s per node) | small-mid scale |
| **ClickHouse ★★** (write > 100k/s) | columnar 압축 10x, 매우 fast aggregation | JOIN 약함, 운영 복잡 | large scale |
| InfluxDB | 시계열 전용 단순함 | high cardinality (device_id 1M) 성능 저하 | low cardinality only |
| Cassandra | 무한 scale | aggregation 약함, 운영 부담 | write only, query 별도 |

**선택**: **단계별** —
- Phase 1-2 (< 50k/s): TimescaleDB (1 cluster)
- Phase 3+ (> 100k/s): ClickHouse migration (write 강함 + columnar 압축)
- 분기점: `write_qps × payload > 50MB/s` 또는 high-cardinality query 가 무거워지면

### 6-5. **Cold tier 압축 + TTL**

| 단계 | tier | 비용 | 검색 |
|---|---|---|---|
| 0-30일 | S3 Standard | $23/TB/mo | ms 단위 (Athena) |
| 30-90일 | S3 Standard-IA | $12.5/TB/mo | ms |
| 90일-1년 | S3 Glacier Instant | $4/TB/mo | ms |
| 1년-5년 | **S3 Glacier Deep Archive ★** | $1/TB/mo | 12-48시간 후 retrieval |
| 5년+ | DELETE | - | - |

**선택**: Lifecycle policy 자동 transition.
- Hot ClickHouse 에 1년 (rich query)
- 0-30일은 S3 Standard 도 동시 유지 (Athena 빠른 query)
- 30일 → IA → Glacier → Deep Archive
- 5년 → 자동 delete (또는 컴플라이언스 따라 무한 보존)

### 6-6. **Clock skew 처리**

디바이스는 NTP 동기화 안 된 경우 시간이 틀릴 수 있음.

| 시간 source | 신뢰도 | 사용 |
|---|---|---|
| `ts_device` (디바이스 클럭) | 낮음 (skew 가능) | 디버깅용 보조 |
| **`ts_ingested` (broker 시간) ★** | 높음 (NTP 동기) | 모든 bucket / 정렬 |
| Kafka `producerTimestamp` | 중간 | 일관성 검증 |

**선택**: **Bucketing / 정렬 / TTL 모두 `ts_ingested` 만 사용**. `ts_device` 는 schema 보존하되 query 기본 X.

---

## 7. Failure Modes

| 장애 | 영향 | 대응 |
|---|---|---|
| **디바이스 offline 윈도우** | telemetry 누락 | 디바이스 local buffer (flash) + 재연결 시 backfill — QoS 1 보장 |
| **Broker 단일 다운** | 일부 connection drop | cluster + sticky session + client retry (exp backoff) |
| **Kafka bridge 백프레셔** | broker 메모리 폭증 | bridge 가 Kafka producer block → broker queue 한계 → device 재시도 |
| **Schema 호환성 깨짐** | consumer crash | Schema Registry FULL 모드 + CI 배포 시 호환성 검증 |
| **Clock skew (디바이스 시간 미래)** | bucket 잘못 | 항상 `ts_ingested` 사용 |
| **Duplicate** (재전송) | over-count | dedupe by (device_id, ts_device, hash) — Streams state store |
| **Cold tier 손실** | 컴플라이언스 위반 | S3 versioning + cross-region replication + Glacier vault lock |
| **Anomaly 폭증 alert storm** | 알림 폭주 | rate limit + alert grouping (07-notification) |
| **Hot 디바이스 (firmware bug)** | partition skew | sub-key sharding (device_id + random%N) |
| **Device 인증 실패 폭주** | broker 인증 부담 | rate limit per IP + temp blacklist |
| **mTLS cert 만료** | 디바이스 일제 disconnect | cert rotation 자동화 (90일 + 30일 사전 alert) |
| **Stream processor lag** | dashboard stale | autoscale + RocksDB checkpoint + standby |
| **Schema Registry 다운** | producer/consumer 모두 멈춤 | local schema cache + Registry HA cluster |

---

## 8. Scaling Path

### Phase 1 — POC (디바이스 < 1만, 1k msg/s)

```
[Device] → [MQTT broker single] → [Kafka 3 broker]
                                      ↓
                                 [Spring Boot consumer]
                                      ↓
                                 [TimescaleDB single]
```
- Cold tier 없음 (90일만)
- TimescaleDB 단일 인스턴스

### Phase 2 — Production 진입 (디바이스 10만, 10k msg/s)

```
[Device] → [MQTT cluster 3] → [Kafka 6] → [Streams 1min]
                                              ↓
                                         [TimescaleDB master+replica]
                                              ↓
                                         [S3 hourly archive]
```
- Schema Registry 도입
- Cold tier S3 Standard
- Device Shadow Redis

### Phase 3 — Massive scale (디바이스 100만, 100k msg/s) ★

```
[Device 100M conn] → [EMQX cluster 10] → [Kafka 60 part × 6 broker]
                                              ↓
                                         [Flink CEP cluster]
                                              ↓
                              [ClickHouse 6 shard × replica 3]
                                              ↓
                              [S3 lifecycle: Std → IA → Glacier]
```
- TimescaleDB → ClickHouse migration
- Multi-region MQTT (디바이스 가까운 region)
- Glacier Deep Archive 5년

### Phase 4 — Edge computing

- Device → 가까운 edge gateway (5G MEC) → Regional Kafka → Global aggregation
- Edge 에서 1차 집계 (1분 평균) → upstream 전송 → 트래픽 90% 감소
- Edge 가 anomaly detection 1차 수행

---

## 9. Observability

### 핵심 metric

| metric | 임계값 | 알람 |
|---|---|---|
| `mqtt.connected.devices` | baseline ±5% | 이상 탐지 |
| `mqtt.connect.error.rate` | > 1% | warning |
| `mqtt.publish.qps` | baseline ±20% | 이상 탐지 |
| `kafka.bridge.lag.ms` | > 500 | warning |
| `streams.processing.p99.ms` | > 1000 | warning |
| `clickhouse.insert.qps` | < expected | warning |
| `clickhouse.compression.ratio` | < 5x | tuning 필요 |
| `s3.archive.lag.minutes` | > 90 | warning |
| `device.shadow.miss.rate` | > 5% | dashboard 영향 |
| `schema.compatibility.violations` | > 0 | critical |
| `cert.expiry.days` | < 30 | warning, < 7 critical |
| `cold.storage.cost.daily` | budget 대비 | cost guardrail |

### 분산 트레이싱

- traceId 가 device → broker → bridge → Kafka → consumer → DB 전 구간 propagate
- Sampling 0.1% (volume 큼)
- baggage: `device_id`, `firmware_ver`

### Device-level observability

- 디바이스당 metric: last_seen, message_rate, error_count, battery
- offline > 1h alert (운영자 또는 사용자)
- firmware version 분포 dashboard (rollout 관찰)

---

## 10. 면접 트랩

### Trap 1 — "그냥 HTTP POST 하면 되지 않나요?"

**Reality**:
- 100만 디바이스 × 10초 주기 = HTTP connection 10만/s
- TLS handshake overhead = 디바이스 배터리 소모 + 네트워크 비용
- MQTT persistent connection 으로 handshake 1회 + heartbeat 만

### Trap 2 — "QoS 2 가 가장 안전하니 써야죠?"

**Reality**:
- QoS 2 는 4-way handshake → latency 4배 + broker 부담
- QoS 1 (at-least-once) + idempotent consumer 로 충분
- 산업 표준은 QoS 1

### Trap 3 — "schema evolution 어려운데 그냥 JSON 쓰면?"

**Reality**:
- JSON 은 schema enforcement 없음 → 런타임 깨짐
- 디바이스 펌웨어 업데이트 점진적이라 호환성 필수
- Protobuf + Schema Registry FULL 모드 강제

### Trap 4 — "TimescaleDB vs ClickHouse 결정 기준?"

**Reality**:
- 100k/s write 까지는 TimescaleDB (PostgreSQL 친화 + JOIN 가능)
- 100k/s 넘으면 ClickHouse (write 한계 + columnar 압축)
- 마이그레이션 부담 고려 — Phase 1 부터 ClickHouse 도 가능

### Trap 5 — "device clock 이 잘못된 경우?"

**Reality**:
- NTP 안 된 디바이스 = 시간이 미래 또는 과거
- bucket 정렬 깨짐 → 모든 query 가 broker `ts_ingested` 만
- `ts_device` 는 디버깅 / 디바이스 자체 진단용 보조

### Trap 6 — "duplicate message 어떻게 dedupe?"

**Reality**:
- (device_id, ts_device, message_hash) 로 dedupe key
- Streams state store (RocksDB) 24h window
- 24h 넘은 dup 는 거의 없음 (실용적 선)

### Trap 7 — "cold tier 비용 어떻게 줄이죠?"

**Reality**:
- Glacier Deep Archive ($1/TB/month) — 5년 검색 거의 없음 가정
- S3 lifecycle policy 자동
- Parquet columnar + zstd 추가 압축
- 730 TB × 5y × $1 = $44k 총 5년 비용 (감당 가능)

### Trap 8 — "1M 동시 connection 어떻게?"

**Reality**:
- 단일 broker 한계 ~100k connection (EMQX 도)
- Cluster 10 broker × shared subscription
- Linux file descriptor 한계 (`ulimit -n 1000000`) + epoll
- Load balancer (NLB) — sticky session 으로 reconnect 시 같은 broker

### Trap 9 — "anomaly detection 어디서?"

**Reality**:
- 단순 임계값 → Flink CEP (Complex Event Processing)
- ML 기반 → 별도 서비스 (이 시나리오 out of scope)
- Edge 1차 + 서버 2차 (compute 분산)

### Trap 10 — "디바이스 offline 동안 데이터?"

**Reality**:
- 디바이스 local flash buffer (보통 1-7일치)
- 재연결 시 backlog 전송 → MQTT QoS 1 + persistent session
- ts_device 는 그대로 보존 (delayed ingestion 표시)

### Trap 11 — "compliance / GDPR"

**Reality**:
- device_id 는 hashed (HMAC + salt rotation)
- location 데이터는 PII — region 단위 절삭 또는 fuzz
- 사용자 삭제 요청 → device unbind → 향후 데이터 unlinked
- cold tier 도 archive key 로 검색 가능해야 (forget my data)

### Trap 12 — "firmware update 시 schema 깨지면?"

**Reality**:
- Schema Registry FULL 모드 + CI 가 PR 시점에 호환성 검증
- canary firmware 10% rollout → schema 호환 검증 → 100%
- backward compatibility 깨지면 Registry 가 reject

### Trap 13 — "비용 cap"

**Reality**:
- $100/day budget = 1 cent per 1k messages
- 가장 비싼 부분: Hot tier ClickHouse compute + S3 ingestion
- 절약: edge aggregation, downsampling (1분 → 1시간 평균만 cold tier), Glacier
- cost dashboard + alert 가 필수

---

## 11. msa 코드 grounding

본 msa 에 IoT 직접 구현은 없지만 cross-ref 풍부:

- **analytics** — 이벤트 수집 + ClickHouse 집계 → telemetry pipeline 의 hot tier 와 동일 패턴
- **gateway** — Rate Limiting / 인증 → MQTT broker 인증 패턴 cross
- ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012 (멱등성), ADR-0029 (idempotent consumer) → device duplicate 방어
- ADR-0015 (resilience) → CircuitBreaker / DLQ (Dead Letter Queue, 데드 레터 큐) → broker → Kafka 백프레셔 처리
- ADR-0019 (k8s migration) → MQTT broker 도 K8s StatefulSet 운영
- `docs/architecture/kafka-convention.md` → topic naming `iot.telemetry`, `iot.command`
- 백업/복구 전략 (`docker/backup/README.md`) → cold tier 도 동일 원칙

향후 IoT 도메인 추가 시 `:iot:gateway, :iot:processor, :iot:archive` 모듈 분리 (search 4-모듈 패턴 참고).

---

## 12. 30초 면접 요약

> "IoT telemetry pipeline 은 100만 device, 100k msg/s, 1년 hot + 5년 cold. 핵심은 (1) MQTT 5.0 + EMQX cluster 로 1M 동시 connection (gRPC 는 전력 소모 많음), (2) Protobuf + Schema Registry FULL 모드로 펌웨어 점진 update 시 양방향 호환, (3) Kafka bridge → Flink CEP 1-5s window 로 alert + downsampling, (4) Hot tier — TimescaleDB (< 100k/s) → ClickHouse (> 100k/s) Gorilla codec 10x 압축, (5) Cold tier — S3 Standard → IA → Glacier Deep Archive ($1/TB/mo) 5년 lifecycle, (6) Device shadow Redis 로 offline 디바이스 last value 즉시 조회, (7) Clock skew 회피: bucket / 정렬 모두 broker `ts_ingested` 만, (8) Duplicate dedupe: (device_id, ts_device, hash) 24h 윈도우, (9) cert rotation 90일 + 30일 사전 alert. analytics 서비스의 ClickHouse 패턴 cross."

---

## 부록 A. 흔한 함정

1. **HTTP POST 로 telemetry** — 배터리 소모 + connection overhead → MQTT 필수
2. **QoS 2 강제** — latency 4배, broker 부담 → QoS 1 + idempotent
3. **JSON / schema 강제 없음** — 펌웨어 업데이트 시 깨짐 → Protobuf + Registry FULL
4. **device clock 신뢰** — skew 로 bucket 깨짐 → broker `ts_ingested` 만
5. **TimescaleDB 100k+ 강행** — write 한계 → ClickHouse migration
6. **Cold tier 안 쓰면** — 5년 hot 비용 폭발 → Glacier lifecycle 필수
7. **Schema BACKWARD only** — 디바이스가 옛 firmware 인 동안 새 schema 못 보냄 → FULL 필수
8. **mTLS cert rotation 수동** — 일제 만료 시 disconnect storm → 자동화
9. **broker 단일** — 1M connection 한계 + SPOF → cluster 10+ instance
10. **Anomaly alert storm** — 한 디바이스 폭주 시 alert 폭증 → grouping + rate limit
11. **device shadow 안 쓰면** — offline 디바이스 마지막 값 모름 → Redis Hash 7d TTL
12. **GDPR 무시** — device_id raw 저장 → hash + cold tier 도 forget my data 가능해야
13. **firmware version dashboard 없음** — rollout 영향 추적 불가 → metric 분리
14. **edge aggregation 없음** — upstream 트래픽 폭증 → edge 1차 집계로 90% 감소 가능
