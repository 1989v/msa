---
parent: 6-kafka-internals
seq: 17
title: Streams API — KStream / KTable / GlobalKTable + DSL + EOS V2 + Interactive Queries
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 09-exactly-once.md
  - 14-kraft-tiered-storage.md
  - 15-rebalance-protocols.md
  - 16-log-compaction-tombstone.md
sources:
  - https://kafka.apache.org/40/documentation/streams/
  - https://kafka.apache.org/40/documentation/streams/developer-guide/dsl-api.html
  - https://kafka.apache.org/40/documentation/streams/architecture
  - https://docs.confluent.io/platform/current/streams/concepts.html
  - https://docs.confluent.io/platform/current/streams/developer-guide/interactive-queries.html
  - https://www.confluent.io/blog/enabling-exactly-once-kafka-streams/
catalog-row: "§F KStream/KTable/GlobalKTable, DSL operators, join 종류, Windowing, Aggregation, State Store, Interactive Queries, Streams EOS V2, Suppress (★ → ✅)"
---

# 17. Streams API — KStream / KTable / GlobalKTable + DSL + EOS V2 + Interactive Queries

> 카탈로그 매핑: §99 §F — `KStream / KTable / GlobalKTable`, `DSL operators`, `join 종류`, `Windowing`, `Aggregation`, `State Store`, `Interactive Queries`, `Streams EOS V2`, `Suppress` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> 본 deep file 은 Kafka Streams 의 풀 카탈로그를 한 챕터에 압축 — 1) KStream / KTable / GlobalKTable 의 모델 차이, 2) DSL operator 풀 매트릭스 (map / filter / branch / merge / through / aggregate / windowedBy / 4 종 join), 3) State Store + RocksDB 의 로컬 저장 모델, 4) Streams EOS V2 (가벼운 exactly-once), 5) Interactive Queries 의 state store HTTP 노출, 6) standby replica 로 failover 단축, 7) Streams vs ksqlDB vs Flink 의 선택 기준. msa 의 `analytics:app` 이 이미 Streams 를 사용하므로 grounding 이 풍부하다.

---

## 1. 한 줄 핵심

> **Kafka Streams 는 "Kafka 토픽 을 입력 + 출력 으로 받는 stateful stream processing 라이브러리" — 별도 cluster 가 아니라 application 의 일부로 embedded** 되어 동작한다. 핵심 모델은 셋: **KStream (이벤트 스트림 = append-only)**, **KTable (key 별 최신값 = compacted)**, **GlobalKTable (모든 task 가 전체 복제 보유)**. DSL 은 SQL 비슷한 operator 집합으로 stateful 처리 (aggregate / windowing / join) 를 1 줄 단위로 표현하고, 내부적으로 **state store (default RocksDB)** + **changelog topic (compacted)** 으로 fault-tolerance 를 보장한다. **Streams EOS V2** 는 transactional producer + 자동 idempotency 로 "input → state → output" 의 atomic 처리를 표준 producer 에 비해 가볍게 제공하며, **Interactive Queries** 는 state store 를 application HTTP 로 직접 read 가능하게 해 별도 DB 없이도 read model 을 구현할 수 있게 만든다.

---

## 2. 등장 배경 — 왜 Streams 가 필요한가

### 2-1. 일반 Consumer 의 한계

```kotlin
@KafkaListener(topics = ["analytics.event.collected"])
fun consume(event: AnalyticsEvent) {
    when (event.eventType) {
        "PRODUCT_VIEW" -> incrementViewCount(event.payload["productId"])
        "PRODUCT_CLICK" -> incrementClickCount(event.payload["productId"])
        // ...
    }
}
```

- 단일 event 처리는 가능.
- "최근 1시간 동안 productId 별 view + click + order 합계" 같은 **stateful aggregation** 은 별도 저장소 (Redis / DB) + 직접 windowing 로직 필요.
- 두 토픽 join (예: order + payment 를 orderId 로 매칭) 도 직접 구현해야 함 (timer / state / cleanup 모두 직접).
- failure recovery 시 in-flight state 손실 위험.

### 2-2. Streams 의 답

```kotlin
events
    .filter { _, e -> e.eventType in listOf(VIEW, CLICK, ORDER) }
    .selectKey { _, e -> e.payload["productId"] }
    .groupByKey()
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofHours(1)))
    .aggregate(
        { ProductMetrics() },
        { _, event, m -> m.apply { add(event) } },
        Materialized.`as`("product-metrics-store")
    )
```

- aggregate / windowing / state store 가 1 chain 에 표현.
- state store 는 RocksDB + changelog topic 으로 자동 backup.
- failure recovery 시 changelog 에서 state restore.
- DSL 한 줄 = "consumer + aggregator + producer + state store" 가 한꺼번에.

### 2-3. Streams 가 cluster 가 아닌 라이브러리인 이유

- application code 에 의존성으로 embed (Maven/Gradle).
- task 분배는 Kafka 의 consumer group 메커니즘 위에 build (별도 master 없음).
- 배포 = 일반 application 배포 (docker/k8s) — 별도 cluster 운영 ❌.
- 가볍게 시작 (Spark / Flink 대비 운영 부담 ↓), application 안에 embed 가능 → BFF (Backend For Frontend) 가 직접 stream 처리도 OK.

---

## 3. 동작 원리 — KStream / KTable / GlobalKTable 모델

### 3-1. 세 모델의 한 줄 정의

| 모델 | 모델링 | 의미 | 입력 토픽 정책 |
|---|---|---|---|
| **KStream** | event log | "X 가 일어났다" 의 무한 sequence | retention (delete) 자연스러움 |
| **KTable** | latest-per-key | "X 의 현재 값은 Y" 의 변화 시퀀스 | compact 자연스러움 |
| **GlobalKTable** | latest-per-key, **모든 task 가 full copy** | "전역 lookup table" | compact + 작은 데이터 |

### 3-2. KStream — 이벤트 스트림

```
Topic: analytics.event.collected
  (k=user1, v={"type":"VIEW","productId":42})  ← event 1
  (k=user1, v={"type":"VIEW","productId":42})  ← event 2 (같은 key 라도 별개)
  (k=user1, v={"type":"CLICK","productId":42}) ← event 3

KStream 으로 read:
  3 개의 event 가 그대로 흐른다.
  같은 key 라도 합쳐지지 않음.
  count() 시 → 3 (event 수)
```

### 3-3. KTable — table 모델

```
Topic: user.profile  (compacted)
  (k=user1, v={"tier":"BRONZE"})
  (k=user1, v={"tier":"SILVER"})
  (k=user1, v={"tier":"GOLD"})

KTable 으로 read:
  같은 key 의 record 를 latest 로 갱신.
  user1 의 현재 값 = {"tier":"GOLD"}.
  count() 시 → 1 (key 수)

tombstone (k=user1, v=null) → user1 entry 삭제.
```

### 3-4. GlobalKTable — 전역 복제

```
일반 KTable: partition 별로 task 가 자기 partition 만 보유
  task-0 has partition 0 의 KTable
  task-1 has partition 1 의 KTable

GlobalKTable: 모든 task 가 토픽 전체를 복제
  task-0 has 전체 KTable
  task-1 has 전체 KTable
  ...

→ 메모리 사용 ↑↑
→ 단, KStream-GlobalKTable join 시 co-partitioning 불필요 (어떤 key 라도 lookup 가능)
```

### 3-5. 변환 — 셋 사이의 변환

```
KStream → KTable    : groupBy + reduce/aggregate
KStream → KTable    : toTable() (3.x+)
KTable → KStream    : toStream() (변경 record 만 emit)
KTable → KTable     : map / filter / join — 변환된 KTable
KStream → GlobalKTable : (직접 변환 없음, 별도 topic 으로 build)
```

### 3-6. 토폴로지 + Task

```
DSL → topology (DAG)
topology 의 sub-topology 단위로 task 분할
task 수 = max(input topic 의 partition 수)

3 partition input → 3 task
3 application instance → instance 당 1 task (균등 분배)
1 application instance → instance 가 3 task 모두 보유
```

### 3-7. State Store + Changelog Topic

```
[application instance A]
   ┌──────────────────────────────┐
   │ Streams App (analytics)      │
   │                               │
   │  ┌────────────────────────┐  │
   │  │ Task 0 (partition 0)   │  │
   │  │  state store:          │  │
   │  │    /tmp/.../store-0    │  │     local RocksDB
   │  │    (RocksDB)           │  │
   │  └────────┬───────────────┘  │
   │           │ write             │
   │           ▼                   │
   │   ─────────────────────────  │
   │   changelog topic (compact)   │ → Kafka 에 자동 publish
   │   "analytics-store-changelog" │
   └──────────────────────────────┘

restart 시:
   1. changelog 토픽을 처음부터 read
   2. local RocksDB 에 replay
   3. 마지막 offset 부터 정상 처리 시작

→ State store = local cache, changelog topic = source of truth
```

---

## 4. DSL operators — 풀 카탈로그

### 4-1. Stateless operators

| operator | 의미 | 예시 |
|---|---|---|
| `map` | 1:1 변환 | `events.map { k, v -> KeyValue(k, v.uppercase()) }` |
| `mapValues` | value 만 변환 (key 보존) | `events.mapValues { v -> v * 2 }` |
| `filter` | 조건 만족 record 만 통과 | `events.filter { k, v -> v.amount > 0 }` |
| `flatMap` | 1:N 변환 | `events.flatMap { ... }` |
| `branch` (3.x: `split`) | 조건별 multiple stream | `events.split().branch(predicate1).branch(predicate2)` |
| `merge` | 두 stream 합치기 | `s1.merge(s2)` |
| `selectKey` | re-key | `events.selectKey { k, v -> v.userId }` (re-partition 발생) |
| `peek` | side-effect (logging) | `events.peek { k, v -> log(k, v) }` |
| `through` (deprecated 3.x) → `repartition` | 명시적 re-partition + topic 통과 | `events.repartition(...)` |
| `to` | sink — 토픽 출력 | `events.to("output-topic")` |

### 4-2. Stateful operators (require state store)

| operator | 의미 | 결과 |
|---|---|---|
| `groupByKey` | 같은 key 끼리 묶기 (selectKey 없으면 호출) | KGroupedStream |
| `groupBy` | 새 key 로 묶기 (re-key + group) | KGroupedStream |
| `count` | 개수 | KTable<K, Long> |
| `reduce` | 같은 key 의 value 들 누적 (single type) | KTable<K, V> |
| `aggregate` | 같은 key 의 value 들 누적 (different result type) | KTable<K, R> |
| `windowedBy` | window 추가 | TimeWindowedKStream / SessionWindowedKStream |
| `suppress` | window 의 update 를 final 까지 억제 | KTable |

### 4-3. Windowing 4 종

```
[Tumbling — non-overlapping fixed]
  |--w1--|--w2--|--w3--|
  size = 1h, advance = 1h (= size)
  → 같은 시간대 event 들을 한 묶음

[Hopping — overlapping fixed]
  |--w1--|
       |--w2--|
            |--w3--|
  size = 1h, advance = 30min
  → 매 30분마다 "최근 1시간" window emit

[Session — gap-based]
  ev1 ev2  (gap > inactivity)  ev3 ev4
  |---s1---|                     |---s2---|
  inactivity gap = 30min
  → user 의 session 단위 처리

[Sliding — every event boundary]
  |w (event 1 시점 기준 -1h)|
   |w (event 2 시점 기준 -1h)|
  size = 1h
  → 모든 event 가 자기 시점의 window
```

### 4-4. join 4 종

```
[1] KStream-KStream join (windowed, must be windowed!)
   - "결제 event 와 주문 event 가 같은 orderId 이고 30 분 안에 들어옴"
   - JoinWindows.of(Duration.ofMinutes(30))

[2] KStream-KTable join (non-windowed)
   - "주문 event 가 들어올 때 user profile 의 현재 tier 와 lookup"
   - co-partitioning 필요 (같은 key, 같은 partition 수)

[3] KTable-KTable join (non-windowed)
   - "두 KTable 을 같은 key 로 inner/left/outer join"
   - 결과는 또 KTable

[4] KStream-GlobalKTable join (non-windowed)
   - "주문 event 와 product catalog (전역) join"
   - co-partitioning 불필요, 단 GlobalKTable 메모리 부담
```

### 4-5. 재미있는 패턴: stream-table duality

```
KStream → groupByKey + reduce → KTable
KTable.toStream() → KStream (변경 stream)

→ 한 데이터를 두 view 로 자유롭게 변환 가능
→ "현재 상태" 가 필요하면 KTable, "변경 history" 가 필요하면 KStream
```

### 4-6. Suppress — window 결과 억제

```
window 가 1h tumbling 일 때:
  - default: window 의 매 update 마다 downstream emit
  - 1 시간 동안 1000개 event 들어오면 1000번 emit

suppress(Suppressed.untilWindowCloses(...)) → window 가 닫힐 때 1 번만 emit

→ downstream 부담 ↓, 단 latency = window size 만큼 발생
→ 분/시간 단위 보고서 / 알람에 적합
```

---

## 5. Streams EOS V2 — 가벼운 exactly-once

### 5-1. 일반 transactional producer 의 부담

```
producer.beginTransaction()
producer.send(record1)
producer.send(record2)
producer.commitTransaction()

→ 매 transaction 마다 begin/commit 2 RPC + transactional state log write
→ throughput 손실 + latency ↑
```

### 5-2. Streams EOS V2 (KIP-447, 2.6+)

- producer 와 consumer 가 같은 application 안에 있는 Streams 의 특성 활용.
- `processing.guarantee = exactly_once_v2` (이전엔 `exactly_once`).
- consumer 의 offset commit 도 transaction 안에 포함 (consumer.commitSync() 가 producer.sendOffsetsToTransaction() 으로 대체).
- 같은 application 의 모든 task 가 1 producer 공유 (이전: task 마다 1 producer) → throughput 손실 ↓.

### 5-3. EOS 가 보장하는 것

```
[Streams 처리 cycle]
  consumer.poll() → 처리 → state store update → producer.send() → offset commit

EOS V2 가 atomic 하게 묶음:
  - input record 의 offset commit
  - state store 의 changelog write
  - output record 의 send

→ 셋 다 commit 되거나 셋 다 rollback
→ 재시작 시 정확히 같은 위치에서 정확히 같은 결과 보장
```

### 5-4. EOS V2 활성화

```kotlin
val props = mutableMapOf<String, Any>(
    StreamsConfig.APPLICATION_ID_CONFIG to "analytics-streams",
    StreamsConfig.PROCESSING_GUARANTEE_CONFIG to StreamsConfig.EXACTLY_ONCE_V2,
    StreamsConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
    // ...
)
```

추가 필수:
- broker `transaction.state.log.replication.factor >= 3` (msa prod 는 충족)
- broker `transaction.state.log.min.isr >= 2`
- input topic / changelog 가 RF >= 3

### 5-5. EOS V2 의 비용

| 차원 | 비용 |
|---|---|
| throughput | -5 ~ -15% (transaction overhead) |
| latency | +10~30ms (transaction commit RPC) |
| broker 부하 | `__transaction_state` 토픽 write ↑ |
| 운영 복잡도 | transaction id 관리 (자동) |

→ "정확성 critical" 워크로드 (결제 / 재고) 에만 EOS, 그 외 (analytics) 는 at-least-once 가 자연스러움.

### 5-6. msa 의 분석 워크로드는 어떨까

`analytics:app` 의 Streams 는 score 계산 — 약간의 중복 처리는 score 가 noisy 해질 뿐 비즈니스 영향 ↓. 따라서 **at-least-once 유지**, EOS V2 미도입이 합리.

---

## 6. State Store + RocksDB

### 6-1. RocksDB 가 default 인 이유

- LSM-tree 기반 → write-heavy 워크로드 (state update 빈번) 에 강함.
- on-disk → state 가 heap 사용 안 함 (JVM GC 압력 ↓).
- key/value 단순 모델 → Streams 의 state 표현에 자연스러움.
- bulk write → changelog replay 빠름.

### 6-2. 메모리 / 디스크 사이징

| 자원 | 사용 |
|---|---|
| RocksDB block cache | 메모리 — default 50MB / store, 큰 store 면 늘려야 |
| memtable | 메모리 — recent write |
| SST file | 디스크 — 영구 저장 |
| 합계 | task 수 × store 수 × (block cache + memtable + open files) |

→ task 수 폭증하면 RocksDB 자원 폭증. **task 당 자원 한계 명시 권장**.

### 6-3. in-memory store 옵션

```kotlin
Materialized.`as`(InMemoryKeyValueStore("store-name"))
```

- 메모리 위 only — 빠름, 단 heap 압력.
- changelog 는 그대로 → restart 시 복원.
- 작은 KTable / 짧은 window 에 적합.

### 6-4. State store 의 복원

```
[application instance A 가 죽고 다시 살아남]
  1. Streams 가 task 0 을 다시 할당받음
  2. local RocksDB 가 비어있음 (PV 가 없으면)
  3. changelog topic 을 처음부터 read
  4. RocksDB 에 replay (compact 토픽이라 key 별 최신만 적용 → 빠름)
  5. 정상 처리 시작

[changelog 가 큰 경우]
  복원 시간 = changelog 의 unique key 수 × replay 시간
  큰 store 면 분 ~ 시간 걸림
```

→ 복원 시간 단축 = **standby replica**.

### 6-5. Standby replica

```
StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG = 1

→ 각 task 가 active 1 + standby 1
→ standby 는 active 와 같은 changelog 를 read 해서 자기 RocksDB 에 적용
→ active 가 죽으면 standby 가 즉시 promote → 복원 시간 거의 0
```

비용:
- application instance × N → 메모리 / 디스크 / 네트워크 사용 N+1 배.
- standby 도 changelog read 하므로 broker fetch 부하 ↑.

→ stateful 처리 + low latency 가 필요한 곳에 도입.

---

## 7. Interactive Queries — state store HTTP 노출

### 7-1. 무엇

Streams 의 state store 를 application 의 REST API 로 직접 query 할 수 있게 함. 별도 DB 없이도 read model 구현 가능.

```kotlin
@RestController
class ScoreQueryController(private val streams: KafkaStreams) {

    @GetMapping("/scores/{productId}")
    fun getScore(@PathVariable productId: String): ProductMetrics? {
        val store: ReadOnlyKeyValueStore<String, ProductMetrics> =
            streams.store(
                StoreQueryParameters.fromNameAndType(
                    "product-metrics-store",
                    QueryableStoreTypes.keyValueStore()
                )
            )
        return store.get(productId)
    }
}
```

### 7-2. 다중 instance + 라우팅

```
3 instance × 3 task → productId 의 partition 이 어느 instance 에 있는지 라우팅 필요

Streams 가 metadata 제공:
  KafkaStreams.queryMetadataForKey("product-metrics-store", productId, serializer)
  → activeHost, standbyHosts 반환

라우팅 로직:
  if (activeHost == thisHost) {
      return localStore.get(productId)
  } else {
      return restClient.get("http://${activeHost}/scores/${productId}")
  }
```

→ application 자체가 scatter-gather 또는 forward 하는 게 표준 패턴.

### 7-3. 트레이드오프

| 장점 | 비용 |
|---|---|
| 별도 read DB 불필요 | application 코드 ↑ (라우팅 / failover) |
| state 가 가까움 — 매우 낮은 latency | rebalance 중엔 일시 unavailable |
| changelog 에서 자동 복구 | application restart 시 복원 시간 |

### 7-4. msa 적용 가능성

`analytics:app` 이 score 를 ClickHouse 에 저장 + Redis cache. Interactive Queries 도입 시:
- 추가 인프라 (ClickHouse) 의존 ↓.
- 단 multi-instance 라우팅 코드 + rebalance 시 read fail 처리 필요.
- 현재 ClickHouse 가 OLAP 분석 + reporting 에도 쓰이므로 Interactive Queries 만으로 대체 어려움.

→ **부분 도입** 후보 — score 의 hot read (검색 ranking 시 호출) 만 Interactive Queries, OLAP 분석은 ClickHouse 유지.

---

## 8. Streams vs ksqlDB vs Flink

### 8-1. 비교 매트릭스

| 차원 | Kafka Streams | ksqlDB | Apache Flink |
|---|---|---|---|
| **모델** | Java/Kotlin DSL 라이브러리 | SQL-like (CREATE STREAM/TABLE) | DSL + DataStream + SQL |
| **배포** | application 일부 (embedded) | 별도 cluster | 별도 cluster (JobManager + TaskManager) |
| **state** | RocksDB (local) + changelog | RocksDB (local) + changelog | RocksDB / FsStateBackend |
| **EOS** | EOS V2 (가벼움) | Streams 위에 build | Two-phase commit (Kafka sink) |
| **운영 부담** | 낮음 (app 배포만) | 중간 (kSQL cluster) | 높음 (Flink cluster) |
| **window** | tumbling/hopping/session/sliding | 동일 | 더 풍부 (event time, watermark, late data) |
| **late data 처리** | 제한적 (grace period) | 제한적 | watermark + side output 강력 |
| **언어** | Java/Kotlin | SQL only | Java/Scala/Python/SQL |
| **대표 use case** | 가벼운 stateful processing | analyst-friendly, ETL | 복잡한 event-time, ML pipeline |

### 8-2. 선택 기준

| 시나리오 | 권장 |
|---|---|
| application 안에서 가볍게 aggregation | **Streams** |
| analyst 가 SQL 로 stream 정의 | **ksqlDB** |
| event-time 처리 + late data 핸들링 critical | **Flink** |
| 1 day window, 분 단위 emit | Streams 또는 ksqlDB |
| 수십초 latency + 복잡한 join 그래프 | Flink |
| 운영 인력 < 5 | Streams (cluster 부담 ↓) |
| 운영 인력 > 20 + ML 통합 | Flink |

### 8-3. msa 의 선택

- 현재 analytics 는 Streams. 적합 — application 안에서 score 계산 + 별도 cluster ❌.
- ksqlDB / Flink 도입 검토 시점: late data / out-of-order 처리가 critical 해지거나, SQL 인터페이스를 분석가에게 제공 필요할 때.

---

## 9. msa 적용 — analytics 의 Streams 분석 + 강화안

### 9-1. 현재 토폴로지 (`analytics/app/.../AnalyticsStreamTopology.kt`)

```
INPUT_TOPIC: analytics.event.collected (partitions=12)
   ▼
filter (PRODUCT_VIEW / PRODUCT_CLICK / ORDER_COMPLETE)
   ▼
selectKey (productId)
   ▼
groupByKey
   ▼
windowedBy (1h tumbling, no grace)
   ▼
aggregate (ProductMetrics)
   ▼
to Stream + foreach (Redis cache + ClickHouse + KafkaTemplate publish)

별도 branch: keyword 기반 (selectKey by keyword)
```

### 9-2. 잠재 개선안

#### 개선 1: Suppress 도입

현재 1h window 가 매 event 마다 update emit → Redis / ClickHouse / Kafka publish 모두 매 event. 1h 마다 1번만 emit 으로 충분.

```kotlin
.aggregate(...)
.suppress(Suppressed.untilWindowCloses(Suppressed.BufferConfig.unbounded()))
.toStream()
.foreach { ... }
```

→ Redis / ClickHouse / Kafka publish 횟수 1/N 감소. latency 는 1h 까지 상승 (수용 가능).

#### 개선 2: Standby replica = 1

```kotlin
StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG to 1
```

→ application instance 가 1 → 2 + standby 1 이라면 failover 시 복원 시간 거의 0.

#### 개선 3: foreach 대신 to topic

현재 `foreach` 안에서 Redis / ClickHouse / Kafka publish. 이건 EOS 와 호환 ❌ (foreach 는 transaction 밖 side-effect).

```kotlin
.aggregate(...)
.toStream()
.mapValues { ... ProductScore }
.to("analytics.score.updated")        // EOS 안에서 atomic
```

별도 consumer 가 `analytics.score.updated` 를 read 해서 Redis / ClickHouse 에 write. **deferred dual-write** 패턴.

#### 개선 4: KTable-KTable join 으로 user profile enrichment

현재 event 는 raw — user profile 정보 (tier 등) 가 없음. user profile 토픽 (compacted) 을 KTable 로 read 해서 join:

```kotlin
val userProfile: KTable<String, UserProfile> =
    builder.table("user.profile.compacted")

events
    .selectKey { _, e -> e.userId }
    .leftJoin(userProfile) { event, profile ->
        EnrichedEvent(event, profile?.tier ?: "GUEST")
    }
    .selectKey { _, e -> e.payload["productId"] }
    // ... 이후 동일
```

→ enriched score (tier 별 가중치) 가능.

#### 개선 5: Interactive Queries 로 score read

검색 service 가 product score 를 read 할 때 현재 Redis. analytics:app 에 IQ endpoint 노출하면 Redis 의존 ↓. 단 multi-instance 라우팅 코드 필요 — 별도 ADR.

### 9-3. 리스크 정리

| 개선안 | 리스크 |
|---|---|
| Suppress | 1h latency — 신규 상품의 score 가 즉시 안 보임 |
| Standby | RocksDB 디스크 + memory 사용 ~2x |
| `to topic` 후 별도 consumer | 추가 토픽 + consumer pod |
| KTable join | user.profile.compacted 토픽 발행 필요 (새 ADR) |
| Interactive Queries | analytics:app 의 multi-instance 라우팅 코드 |

---

## 10. ADR 후보

> **ADR-XXXX: analytics Streams 의 Suppress + Standby replica 도입**
>
> **Context**: `analytics:app` 의 Kafka Streams 가 1h tumbling window 로 productId / keyword 별 score 계산. 현재 매 event 마다 aggregate update 가 downstream (Redis cache + ClickHouse + Kafka publish) 으로 emit → 외부 IO 폭증. 또한 standby replica 미설정 → application instance 죽었을 때 복원 시간 = changelog read 시간 (수분).
>
> **Decision**:
> 1. **`suppress(Suppressed.untilWindowCloses)` 도입** — 1h 마다 1 번만 emit.
> 2. **`NUM_STANDBY_REPLICAS_CONFIG = 1`** — application instance 2+ 인 환경에서.
> 3. **`foreach` 의 외부 IO 분리** — KafkaStream 의 `to("analytics.score.updated")` 만 남기고, Redis / ClickHouse write 는 별도 consumer 로 분리.
> 4. **EOS 는 도입 안 함** — analytics 는 정확성 < 처리량 (at-least-once 충분).
>
> **Consequences**:
> - (+) Redis / ClickHouse / Kafka publish 외부 IO 1/N 감소.
> - (+) failover 시 복원 시간 거의 0.
> - (+) 외부 IO 가 별도 consumer 로 분리 → Streams 자체는 가볍게 유지.
> - (-) 신규 상품의 score 가 1h 까지 안 보임 (UX 영향 작음).
> - (-) standby replica → memory / disk / 네트워크 ~2x 사용.
> - (-) 별도 consumer pod 추가 — 운영 표면 확장.
>
> **Alternatives 검토**:
> - Suppress 없이 매 event emit 유지 — 외부 IO 폭증, 비용 ↑. 채택 ❌.
> - Standby replica = 2 — over-engineering, instance 가 3+ 되어야 의미. 채택 ❌.
> - EOS V2 도입 — at-least-once 로 충분. 채택 ❌.
> - foreach 유지 — Streams 안에서 외부 IO 가 EOS 와 충돌, scaling 어려움. 채택 ❌.

---

## 11. 면접 한 줄 답변

### Q. KStream 과 KTable 의 차이는?

> "KStream 은 event log 모델 — 같은 key 라도 record 가 여러 개 흐릅니다. KTable 은 latest-per-key 모델 — 같은 key 의 record 는 latest 로 갱신되고, count() 시 key 수가 됩니다. 입력 토픽도 KStream 은 retention(delete), KTable 은 compact 가 자연스럽고, KTable 의 backing store 는 자동 changelog topic 으로 fault-tolerance 가 보장됩니다."

### Q. GlobalKTable 이 일반 KTable 과 다른 점은?

> "일반 KTable 은 partition 별로 각 task 가 자기 partition 만 보유 — KStream-KTable join 시 co-partitioning (같은 key, 같은 partition 수) 필요. GlobalKTable 은 모든 task 가 토픽 전체를 복제 보유 — co-partitioning 불필요라 어떤 key 로도 lookup 가능. 단 메모리 부담이 partition 수 배로 증가하므로 작은 reference data (product catalog, country code) 에만."

### Q. Streams 의 EOS V2 가 일반 transactional producer 보다 가벼운 이유는?

> "Streams 의 input consumer 와 output producer 가 같은 application 안에 있다는 사실을 활용해서, consumer offset commit 도 producer transaction 안에 포함시키고 (sendOffsetsToTransaction), 같은 application 의 모든 task 가 하나의 producer 를 공유합니다. 이전 V1 은 task 마다 producer 라 transaction id / state 부담이 컸는데 V2 는 그 overhead 가 줄어듭니다."

### Q. Suppress 가 푸는 문제는?

> "1 h tumbling window 가 매 event 마다 update 를 downstream 으로 emit 하는 default 동작입니다. Suppress(untilWindowCloses) 는 window 가 닫힐 때 1 번만 emit 하게 해서 downstream 부담을 1/N 로 줄입니다. 단 latency 가 window size 만큼 발생하므로 분/시간 단위 보고서나 알람에 적합합니다."

### Q. State store 의 RocksDB 가 default 인 이유는?

> "LSM-tree 기반이라 stateful stream processing 의 write-heavy 워크로드에 강하고, on-disk 라 JVM heap 압력이 없으며, key/value 단순 모델이 Streams 의 state 표현에 자연스럽습니다. 반대로 작은 store 거나 매우 빠른 read 가 필요하면 in-memory store 도 옵션이고, 두 경우 모두 changelog topic 으로 fault-tolerance 는 보장됩니다."

### Q. Standby replica 가 푸는 문제는?

> "application instance 가 죽었을 때 새 instance 의 RocksDB 는 비어 있으므로 changelog topic 을 처음부터 replay 해야 하는데 큰 store 면 수분~수시간 걸립니다. Standby replica 는 active 와 같은 changelog 를 read 해서 미리 RocksDB 를 만들어 두는 hot standby — failover 시 복원 시간이 거의 0 이 됩니다. 단 메모리/디스크/네트워크 사용량이 N+1 배가 됩니다."

### Q. Interactive Queries 의 트레이드오프는?

> "별도 read DB 없이 Streams 의 state store 를 application HTTP 로 직접 query 할 수 있어 latency 가 매우 낮습니다. 단 multi-instance 환경에선 productId 의 partition 이 어느 instance 에 있는지 metadata 로 라우팅하고, rebalance 중엔 일시 unavailable 인 시간을 코드로 처리해야 합니다. application 자체가 scatter-gather 또는 forward 를 구현하는 부담이 있습니다."

### Q. Streams 와 Flink 의 선택 기준은?

> "Streams 는 application 의 일부로 embedded 되는 라이브러리라 별도 cluster 가 필요 없어 운영 부담이 낮습니다. Flink 는 별도 JobManager + TaskManager cluster 운영이 필요하지만 event-time + watermark + late data 처리가 훨씬 강력합니다. 가벼운 stateful processing 이면 Streams, 복잡한 event-time 그래프 또는 ML pipeline 통합이면 Flink. msa 의 analytics 는 application 내 가벼운 aggregation 이라 Streams 가 적합합니다."

### Q. msa analytics 의 Streams 토폴로지를 어떻게 개선할 수 있나?

> "현재 매 event 마다 aggregate update 가 foreach 안에서 Redis / ClickHouse / Kafka 로 emit 됩니다. Suppress(untilWindowCloses) 로 1h 마다 1 번만 emit, foreach 의 외부 IO 를 별도 consumer 로 분리, standby replica = 1 로 failover 단축 — 셋이 우선 개선안입니다. EOS V2 는 analytics 가 정확성보다 처리량 우선이라 도입 안 함."

---

## 12. 흔한 오해 정정

> **"Streams 는 별도 cluster 가 필요하다"**

- ❌ application 의 일부로 embedded — 라이브러리 의존성 추가 + 일반 application 배포로 충분.

> **"GlobalKTable 이 항상 KTable 보다 좋다"**

- ❌ 메모리 부담이 partition 수 배. 작은 reference data 에만 적합. 큰 데이터엔 일반 KTable + co-partitioning.

> **"EOS V2 를 켜면 latency 와 throughput 영향이 거의 없다"**

- ⚠ throughput -5~15%, latency +10~30ms. "정확성 critical" 워크로드에만.

> **"State store 는 매번 changelog 에서 복원되므로 RocksDB 가 사라져도 괜찮다"**

- ⚠ 옳지만 복원 시간이 분 ~ 시간. 빠른 failover 가 필요하면 standby replica + PV 두 가지 모두.

> **"Interactive Queries 는 항상 read 가능"**

- ❌ rebalance 중엔 일시 unavailable. application 코드가 retry / forward 처리 필요.

> **"foreach 안에서 외부 시스템에 write 하는 게 안전하다"**

- ❌ EOS 와 호환 ❌. transaction 밖 side-effect 라 재시도 시 중복 가능. `to topic` + 별도 consumer 패턴이 권장.

> **"window 의 grace period 를 0 으로 두면 late data 가 버려진다"**

- ✅ 정확. analytics:app 도 `ofSizeWithNoGrace` 라 완벽하게 1h 안에 들어와야 함. late data 가 의미 있다면 `ofSizeAndGrace(1h, 5min)`.

> **"Suppress 를 켜면 모든 update 가 1번 emit 으로 줄어든다"**

- ⚠ window 가 닫힐 때만. event 가 늦게 오면 새 update 가 또 emit. 정확한 1번 보장 = `untilWindowCloses` + grace=0.

> **"Streams 의 task 분배는 Streams 자체가 한다"**

- ⚠ 부분 정답. Streams 는 consumer group 메커니즘 위에 build — 즉 task 분배는 Kafka 의 consumer rebalance 위. cooperative + static 적용 가능.

> **"ksqlDB 는 Streams 의 더 좋은 버전"**

- ❌ ksqlDB 는 Streams 위에 SQL 인터페이스 build. 동일 layer 가 아니라 그 위. 운영자/분석가 친화 vs 개발자 친화 의 차이.

---

## 13. 회독 체크리스트

> §17 회독 체크리스트:
> - [ ] KStream / KTable / GlobalKTable 의 모델 차이 (event vs latest-per-key vs 전역 복제)
> - [ ] 입력 토픽 정책: KStream = delete, KTable = compact 가 자연스러움
> - [ ] DSL stateless / stateful operator 풀 매트릭스
> - [ ] Windowing 4 종 (tumbling / hopping / session / sliding) 의 의미 차이
> - [ ] join 4 종 (KStream-KStream / KStream-KTable / KTable-KTable / KStream-GlobalKTable) 와 co-partitioning
> - [ ] State store + changelog topic 모델 (local cache + Kafka 가 source of truth)
> - [ ] RocksDB 가 default 인 이유 (LSM + on-disk + GC 압력 ↓)
> - [ ] Standby replica 가 failover 시간 단축 + N+1 자원 비용
> - [ ] Streams EOS V2 의 핵심 (consumer offset 도 transaction 안 + producer 공유)
> - [ ] EOS V2 의 비용 (-5~15% throughput, +10~30ms latency)
> - [ ] Interactive Queries 의 동작 + 라우팅 / rebalance unavailable 처리
> - [ ] Suppress(untilWindowCloses) 가 외부 IO 1/N 감소시키는 패턴
> - [ ] Streams vs ksqlDB vs Flink 의 선택 기준
> - [ ] msa analytics 의 5 가지 잠재 개선안 (Suppress / Standby / to topic / KTable join / IQ)

---

## 14. 연결 학습

- §02 retention / compaction — KTable backing topic 이 compact 정책의 1차 사용처
- §07 consumer rebalance — Streams 의 task 분배가 그 위에 build
- §09 exactly-once — EOS V2 가 그 가벼운 변형
- §14 KRaft + tiered storage — controller failover 후 Streams 의 task 재분배
- §15 cooperative + static — Streams 의 internal consumer 도 같은 protocol 사용
- §16 (이전) log compaction + tombstone — KTable / changelog topic 의 default 정책
