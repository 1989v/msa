---
parent: 6-kafka-internals
seq: 16
title: Log Compaction + Tombstone — key 단위 최신값 유지의 모든 것
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 02-offset-retention-compaction.md
  - 05-broker-internals.md
  - 09-exactly-once.md
  - 17-streams-api-kstream-ktable.md
sources:
  - https://kafka.apache.org/40/documentation.html#compaction
  - https://kafka.apache.org/40/documentation.html#design_compactionbasics
  - https://docs.confluent.io/platform/current/installation/configuration/topic-configs.html
  - https://debezium.io/documentation/reference/stable/connectors/mysql.html
catalog-row: "§E Compaction (★ → ✅), Mixed (delete + compact) (★ → ✅), Tombstone (★ → ✅), Compacted topic 사용 패턴 (★ → ✅)"
---

# 16. Log Compaction + Tombstone — key 단위 최신값 유지의 모든 것

> 카탈로그 매핑: §99 §E — `Compaction (log compaction)`, `Mixed (delete + compact)`, `Tombstone`, `Compacted topic 사용 패턴` (★ → ✅).
> 학습 시간 예상: ~2h · 자가평가 입구 레벨: B

> §02 가 retention 과 compaction 의 동작을 한 번 다뤘다면, 본 deep file 은 **compaction 의 segment 단위 mechanic, tombstone 의 lifecycle, mixed (delete + compact) 정책의 의미, KTable / outbox / saga state 같은 "compacted topic 의 운영 패턴", 그리고 흔한 운영 함정 (tombstone 사라짐 / 작은 segment 폭증 / cleaner 정체)** 을 정리하는 챕터. msa 의 향후 outbox / saga / configuration topic 도입 시 직접 참조할 패턴.

---

## 1. 한 줄 핵심

> **Compaction 은 "key 별로 최신 value 만 남기는" log cleaning 정책 — retention (시간/크기 기반 삭제) 과 직교한다.** 핵심은 **append-only log + compact 후 동일 key 는 최신 1개만 살아남음** 이라는 모델인데, 삭제하려면 `value=null` 인 **tombstone** 을 넣어 cleaner 가 일정 시간 (`delete.retention.ms`) 후 그 key 의 모든 record 를 정리. **Mixed (`cleanup.policy=compact,delete`)** 는 둘을 결합 — 일정 시간 지나면 compact 된 record 도 시간 기반 삭제. KTable / `__consumer_offsets` / outbox / saga state / configuration topic 이 모두 이 정책 위에 서 있다. **운영 함정은 tombstone 의 보존 윈도우, segment.ms 의 cleaner trigger, min.compaction.lag.ms 의 보호 윈도우** 셋.

---

## 2. 등장 배경 — 왜 retention 만으론 부족한가

### 2-1. retention (delete) 의 모델

```
[cleanup.policy = delete (default)]
파티션 0 의 segment 들:
  [segment-0000000000.log]  ← oldest, retention.ms 초과 → 삭제
  [segment-0000010000.log]
  [segment-0000020000.log]  ← active

→ 시간/크기 초과한 통째 segment 를 삭제
→ 삭제 단위 = segment, 따라서 최근 ~`segment.ms` 정도 latency
```

이 모델은 **"이벤트 스트림의 이력 (audit log)"** 에는 자연스럽다. 하지만 **"각 entity 의 현재 상태"** 를 표현하기엔 부적합:

```
key=user-42 의 value 변천:
  offset 100: {name: "Alice", tier: "BRONZE"}
  offset 250: {name: "Alice", tier: "SILVER"}
  offset 500: {name: "Alice", tier: "GOLD"}

retention=7d 가 지나면 offset 100, 250 만 삭제되고 500 유지? ❌
retention=7d 면 7d 지난 segment 통째로 삭제 — 500 도 같이 사라짐
→ "user-42 의 현재 tier 는 GOLD" 라는 **상태**를 영구 보존 못 함
```

### 2-2. 상태 영구 보존이 필요한 시나리오

| 시나리오 | 무엇을 보관 |
|---|---|
| `__consumer_offsets` | (group, topic, partition) → 현재 commit offset |
| `__transaction_state` | transactional.id → 현재 TX 상태 |
| KTable backing topic | key → 현재 aggregated value |
| Debezium CDC topic | (db, table, pk) → 현재 row state (initial snapshot 후) |
| outbox topic | aggregate id → 마지막 publish 된 event (replay 시 fast-forward) |
| configuration topic | feature flag key → 현재 value |
| user profile topic | userId → 현재 profile snapshot |

→ 이 모든 케이스가 "key 의 최신값을 영구 보관" 을 필요로 함. **compaction 이 그 답.**

### 2-3. compaction 의 한 줄 약속

```
같은 key 의 record 가 여러 개 있으면, cleaner 가 옛 것들을 비동기적으로 정리.
→ 충분히 시간이 지난 뒤엔, 같은 key 의 record 는 최신 1개만 남는다.
→ 단, active segment 의 record 는 정리 대상 ❌ (cleaner 가 건드리지 않음).
```

---

## 3. 동작 원리 — cleaner 가 segment 를 다시 쓰는 방식

### 3-1. 구조: head + tail

```
파티션 N 의 log 구성

[tail: 정리된 segment 들 (clean section)]   |   [head: active + recent (dirty section)]
   각 key 의 최신 1개만 살아남음            |   같은 key 가 여러 번 나올 수 있음
                                          ↑
                                       cleaner 의 마지막 작업 위치 (cleaner offset)
```

- **head (dirty)**: cleaner 가 아직 처리 안 한 영역. active segment 포함.
- **tail (clean)**: cleaner 가 처리 완료. 같은 key 가 한 번씩만 등장.
- cleaner 는 head 영역의 segment 를 read → 같은 key 의 record 중 최신만 남기고 새 segment 로 write → 옛 segment 삭제.

### 3-2. cleaner thread 동작 단계

```
1. dirty ratio 계산: dirty_bytes / (dirty_bytes + clean_bytes)
   (이 ratio 가 min.cleanable.dirty.ratio 초과한 partition 만 후보)

2. 후보 partition 들 중에서 dirty ratio 가장 높은 거 선택

3. log.cleaner.threads (default 1) 가 각각 partition 처리

4. dirty section 을 읽어 (key → 최신 offset) map 생성
   - in-memory 해시맵 (size = log.cleaner.io.buffer.load.factor 기준)

5. dirty 의 segment 들을 다시 한 번 read 하면서 "각 key 의 최신 offset 인 것만" 새 segment 에 write
   - 옛 record (같은 key 의 옛 버전) 는 skip
   - tombstone (value=null) 도 일단 살림 (delete.retention.ms 동안)

6. 새 segment 로 swap, 옛 segment 삭제

7. cleaner offset 갱신 (이제 여기까지는 clean)
```

### 3-3. 핵심 config 5 종

| config | default | 의미 |
|---|---|---|
| `cleanup.policy` | `delete` | `delete` / `compact` / `compact,delete` |
| `min.cleanable.dirty.ratio` | 0.5 | dirty 비율이 50% 넘어야 cleaner 후보 (낮추면 더 자주 정리, CPU ↑) |
| `min.compaction.lag.ms` | 0 | record 가 이 시간 지나기 전엔 compact 대상 ❌ (consumer 가 못 따라잡으면 보호) |
| `max.compaction.lag.ms` | LONG_MAX | record 가 이 시간 지나면 dirty ratio 무관하게 compact 강제 |
| `delete.retention.ms` | 86,400,000 (1d) | tombstone 보관 시간 — 이 시간 지나면 tombstone 도 정리 |
| `segment.ms` | 7d | active segment 가 이 시간 지나면 close (compaction 대상이 됨) |
| `segment.bytes` | 1GB | segment 크기 한계 |

### 3-4. tombstone 의 수명

```
[t=0]   producer: send(key="user-42", value=null)
[t=0]   record 가 active segment 에 들어감
[t=segment.ms 이후] segment close → compaction 대상

[cleaner 가 처리]
        - tombstone 이전의 user-42 record 모두 삭제
        - tombstone 자체는 살려둠 (다른 consumer 가 "user-42 가 삭제됐다" 를 알아야 함)

[t=close + delete.retention.ms]  cleaner 가 tombstone 도 삭제
                                  → 이 후 새로운 consumer 는 user-42 가 한 번이라도 있었는지 모름
```

→ tombstone 의 보존 윈도우 = `segment.ms (close 까지) + delete.retention.ms (cleaner 삭제까지)`. 모든 consumer 가 그 안에 따라잡지 못하면 "삭제 됐는지조차 모르는" 상태가 된다.

### 3-5. dirty ratio 와 trigger

```
파티션 N 의 log 상태:
  total bytes:  10 GB
  clean bytes:   6 GB (이전 cleaner 작업 결과)
  dirty bytes:   4 GB (최근 produce)
  dirty ratio = 4 / 10 = 0.4

min.cleanable.dirty.ratio = 0.5 → 아직 trigger ❌
dirty 가 6 GB 까지 늘어 ratio = 0.5 도달 → cleaner 가 이 partition 처리
```

**튜닝 방향**:
- ratio 낮춤 (0.1) → 자주 정리 → CPU/IO 사용 ↑ → 디스크는 안정적
- ratio 높임 (0.7) → 가끔 정리 → CPU/IO 절약 → 디스크 사용량 spike

### 3-6. min.compaction.lag.ms 의 보호

```
시나리오: consumer 가 주말간 lag 1억 → 월요일 catch-up

producer: key="user-42" 에 매시간 새 value 발행
  hour 0: v0 (offset 1000)
  hour 1: v1 (offset 1100)
  hour 2: v2 (offset 1200)
  ...
  hour 48: v48 (offset 5800)

consumer 가 월요일에 offset 1000 부터 read 하려는데
cleaner 가 v0 ~ v47 을 이미 정리했다면 → consumer 는 v48 부터 받음
→ v0 ~ v47 의 처리 전제 (예: 멱등성) 가 깨질 수 있음

min.compaction.lag.ms = 7d 면 7일 안 된 record 는 cleaner 가 안 건드림
→ consumer 가 7일치 lag 까지는 옛 버전도 받음
```

---

## 4. 사용 예제 — 4 가지 운영 패턴

### 4-1. KTable backing topic (Streams)

Streams 의 KTable 은 내부적으로 **compacted topic** 을 backing 으로 사용.

```kotlin
// Streams DSL — aggregate
events.groupByKey()
      .aggregate(
          { ProductMetrics() },
          { _, event, m -> m.apply { add(event) } },
          Materialized.`as`<String, ProductMetrics, KeyValueStore<Bytes, ByteArray>>(
              "product-metrics-store"
          )
      )
```

이 store 의 backing topic 은 자동으로 `<application-id>-product-metrics-store-changelog`. 설정:

```
cleanup.policy = compact
min.compaction.lag.ms = 0
delete.retention.ms = 86400000  (1d)
```

- key 의 최신 aggregate 값을 영구 보존 → 재시작 시 state restore 빠름.
- tombstone 으로 삭제 (DELETE event) 도 가능.
- §17 에서 풀 다룸.

### 4-2. Outbox topic (transactional outbox pattern)

```
producer 는 비즈니스 트랜잭션 안에서 outbox 테이블에 row 추가
별도 process 가 outbox row 를 읽어 Kafka 에 publish
publish 되면 outbox row 의 key 에 tombstone 을 같이 publish
```

설정:
```
cleanup.policy = compact,delete       ← mixed
retention.ms = 30d                     ← 30일 후 시간 기반 삭제
delete.retention.ms = 7d
min.compaction.lag.ms = 1h             ← 너무 빨리 정리 안 되게
```

- compact 만 쓰면 영구 보존이라 디스크 부담.
- mixed 라 30일 후 시간 기반 삭제 → 옛 outbox 흔적 자연 정리.
- tombstone 7일 보존이면 모든 consumer 가 따라잡기 충분.

### 4-3. Saga state topic

```
saga state topic: key=sagaId, value=현재 단계
  send(sagaId="order-1001", value={"step": "PAYMENT_PENDING"})
  send(sagaId="order-1001", value={"step": "PAYMENT_COMPLETED"})
  send(sagaId="order-1001", value={"step": "INVENTORY_RESERVED"})
  ...
  send(sagaId="order-1001", value={"step": "DONE"})
  send(sagaId="order-1001", value=null)        ← saga 종료 시 tombstone
```

설정:
```
cleanup.policy = compact
min.compaction.lag.ms = 1h
delete.retention.ms = 24h
```

- compact 라 saga 진행 중인 record 의 옛 단계는 정리됨.
- 종료 후 tombstone 으로 삭제 표시 → 1d 후 완전 정리.
- 새 consumer 가 합류해도 "현재 진행 중인 saga 만" 보임 → restart 빠름.

### 4-4. Configuration topic (feature flag)

```
key="feature.search.semantic.enabled", value="true"  → publish
key="feature.search.semantic.enabled", value="false" → publish
key="feature.search.semantic.enabled", value=null    → tombstone (flag 제거)
```

설정:
```
cleanup.policy = compact
min.compaction.lag.ms = 0     ← 즉시 정리 OK (flag 는 가벼움)
delete.retention.ms = 90d      ← 제거 history 길게 보관 (감사용)
```

- 모든 feature flag 의 현재 값을 1 topic 에 보관.
- 새 consumer 합류 시 처음부터 read 하면 모든 flag 의 현재값 회복.
- flag 제거 history 가 90일 보존 → "이 flag 가 언제 제거됐나" 추적 가능.

### 4-5. Debezium CDC

CDC topic 의 default 정책은 다양하지만 자주 쓰이는 패턴:

```
cleanup.policy = compact (initial snapshot 시 keep "row 의 현재 상태")
또는
cleanup.policy = delete (audit log style — 모든 변경 보관)
```

initial snapshot + ongoing CDC 를 합치면 compact 가 자연스러운데, "audit log 가 필요" 하면 delete. **Debezium 은 둘 다 지원**.

---

## 5. 트레이드오프 / 함정

### 5-1. 흔한 운영 함정 5 가지

#### 함정 1: tombstone 사라짐

```
producer: tombstone for key="user-42" at t=0
segment.ms=7d  → t=7d 에 segment close
delete.retention.ms=1d → t=8d 에 cleaner 가 tombstone 정리

consumer A: t=10d 에 group 새로 만들어 처음부터 consume
  → user-42 의 모든 record 가 사라짐 → "user-42" 가 한 번도 존재한 적 없는 것처럼 보임
```

**방어**:
- `delete.retention.ms` 를 충분히 길게 (consumer max lag × 2 이상).
- offline 분석 / 새 consumer 가 자주 등장하는 환경이면 30d+ 권장.

#### 함정 2: 작은 segment 폭증

```
segment.ms = 1h 로 짧게 설정
→ 1시간마다 active segment close → 1시간마다 cleaner 가 처리
→ disk 에 작은 segment file 수천 개 → file descriptor / metadata 부담
→ broker startup 시 모든 segment 의 index 를 load → 시작 시간 ↑
```

**방어**:
- `segment.ms` 는 최소 1d, 보통 7d.
- 진짜 빈도 높은 update 라면 `segment.bytes` (default 1GB) 가 먼저 trigger.

#### 함정 3: cleaner 정체 (cleaner thread 부족)

```
log.cleaner.threads = 1 (default)
compacted topic 수 100 개 → 한 thread 가 100 개 partition 을 순차 처리
→ dirty ratio 가 0.5 도달한 partition 도 한참 후에 처리 → 디스크 사용 spike
```

**방어**:
- `log.cleaner.threads` 를 broker CPU core 의 1/4 정도로.
- compacted topic 수가 많으면 더.

#### 함정 4: min.compaction.lag.ms 너무 짧음

```
min.compaction.lag.ms = 0 (default)
consumer 가 lag 30분 → catch-up 중 cleaner 가 옛 버전 정리 → consumer 가 일부 record 를 놓침
```

**방어**:
- consumer 의 max lag SLO 의 2x 이상으로.
- offline batch consumer 가 있다면 그것의 max lag 기준.

#### 함정 5: dirty ratio 너무 높게

```
min.cleanable.dirty.ratio = 0.9
→ dirty 가 totalsize 의 90% 가 되어야 cleaner 가 동작
→ disk 사용량 spike + cleaner 한 번 동작이 매우 무거움
```

**방어**:
- 0.5 (default) 가 일반적으로 적정.
- 빈번 update 면 0.1~0.3 으로 더 자주 정리.

### 5-2. compact vs delete vs mixed 결정 매트릭스

| 토픽 의도 | 정책 |
|---|---|
| event stream (audit / event sourcing) | `delete`, retention 정책 따름 |
| entity state (현재 값) | `compact` |
| outbox / saga state | `compact,delete` (mixed) — 정리도 + 시간 가드 |
| configuration | `compact` |
| log / metric raw stream | `delete`, 짧은 retention |

### 5-3. compaction 이 깨는 보장

| 보장 | compact 토픽에선 |
|---|---|
| "모든 메시지가 적어도 한 번 처리된다" | ✅ (active 영역까진 그대로) |
| "메시지의 순서가 partition 안에서 유지" | ✅ |
| "모든 record 가 retention 기간 동안 read 가능" | ❌ — 같은 key 의 옛 record 는 사라짐 |
| "delete 한 record 는 절대 read 되지 않는다" | ⚠ — tombstone 보존 윈도우 동안엔 read 됨 |

### 5-4. exactly-once / transactional 과의 상호작용

- transactional producer + compacted topic → 동작 OK. 단 **abort 된 record 도 일단 디스크에 쓰이고** consumer 의 isolation_level=read_committed 가 필터링.
- compaction 자체는 abort/commit marker 인지하므로 abort 된 record 의 본문은 정상 정리됨.
- §09 와 cross-ref.

---

## 6. msa 적용 — 어디에 어떻게 도입할 수 있나

### 6-1. 현재 상태

msa 의 KafkaTopic CR (`k8s/infra/prod/strimzi/kafka-topics.yaml`) 을 보면:

| 토픽 | cleanup.policy | retention | 의도 |
|---|---|---|---|
| `product.item.created/updated` | (default = delete) | 7d | event stream |
| `order.order.completed/cancelled` | (default = delete) | 7d | event stream |
| `inventory.stock.*` | (default) | (default 7d) | event stream |
| `analytics.event.collected` | (default) | 30d | event stream |
| `analytics.score.updated` | (default) | (default 7d) | event stream |

→ **모두 delete (event stream) 정책**. compaction 사용 사례 없음.

### 6-2. 도입 후보 4 가지

#### 후보 1: outbox topic (ADR-0029 준수)

`docs/adr/` 에 outbox 패턴 도입 ADR 이 있다면 (or 후보), outbox 는 compacted 가 자연스러움:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: outbox.product
spec:
  partitions: 6
  replicas: 3
  config:
    cleanup.policy: "compact,delete"
    retention.ms: "2592000000"        # 30d
    delete.retention.ms: "604800000"  # 7d
    min.compaction.lag.ms: "3600000"  # 1h
    segment.ms: "86400000"            # 1d
```

- 30일 후 시간 기반 삭제 (mixed) — 디스크 무한 증가 방지.
- tombstone 1주일 보존 — 모든 consumer 의 catch-up 충분.

#### 후보 2: saga state topic (분산 트랜잭션)

order ↔ inventory 의 saga (현재 미구현) 도입 시:

```yaml
metadata:
  name: saga.order
spec:
  config:
    cleanup.policy: "compact"
    delete.retention.ms: "86400000"   # 1d
    min.compaction.lag.ms: "1800000"  # 30min
```

- saga 종료 후 tombstone 으로 정리.
- 새 consumer 합류 시 active saga 만 보임 → 빠른 시작.

#### 후보 3: configuration topic (feature flag)

전사 feature flag 시스템 도입 시:

```yaml
metadata:
  name: config.feature-flags
spec:
  partitions: 1                        # ordering 보장
  replicas: 3
  config:
    cleanup.policy: "compact"
    delete.retention.ms: "7776000000"  # 90d (감사 history)
    min.compaction.lag.ms: "0"
```

- 각 flag 의 현재 값을 1 토픽에 모음.
- gateway / 모든 service 가 read → 분산 cache 처럼 사용.

#### 후보 4: product profile topic (search 인덱싱 최적화)

현재 `product.item.created/updated` 는 event stream — 같은 productId 의 update 가 여러 개 쌓임. search:consumer 가 lag 일 때 옛 update 도 처리 → 의미 없음.

```yaml
metadata:
  name: product.profile     # 새 토픽, mode=compact
spec:
  partitions: 6
  replicas: 3
  config:
    cleanup.policy: "compact,delete"
    retention.ms: "2592000000"
    delete.retention.ms: "604800000"
    min.compaction.lag.ms: "300000"   # 5min
```

- key=productId, value=현재 product full state (snapshot)
- search:consumer 가 catch-up 시 productId 별 최신 1개만 처리 → 효율 ↑
- 기존 event stream 은 audit 용으로 유지.

→ **이는 큰 ADR — `product.item.*` 와 `product.profile` 의 역할 분담 + 발행 양쪽**. 별도 ADR 후보.

### 6-3. 운영 관찰 — JMX metric

compaction 운영 핵심 metric:

| metric | 의미 | 알람 |
|---|---|---|
| `kafka.log:type=LogCleaner,name=cleaner-recopy-percent` | cleaner 가 다시 쓴 비율 | 90%+ 면 dirty ratio 너무 낮음 |
| `kafka.log:type=LogCleanerManager,name=max-dirty-percent` | 가장 dirty 한 partition | 0.7+ 면 cleaner 정체 |
| `kafka.log:type=LogCleanerManager,name=time-since-last-run-ms` | cleaner 마지막 작업 후 시간 | 1h+ 면 thread 부족 의심 |
| `kafka.log:type=LogCleaner,name=dead-thread-count` | 죽은 cleaner thread | 0 이 정상 |

→ tiered storage 와 무관 — broker 의 로컬 segment cleaning.

---

## 7. ADR 후보

> **ADR-XXXX: Compacted topic 도입 표준 — outbox / saga / configuration**
>
> **Context**: msa 의 모든 Kafka 토픽이 `cleanup.policy=delete` (default) 로 운영. 향후 outbox / saga / feature flag 같은 "entity state" 보관 시나리오가 등장하면 compact 정책이 자연스럽지만, msa 에 운영 표준이 없어 ad-hoc 결정 위험.
>
> **Decision**:
> 1. **세 가지 compact 토픽 표준 매트릭스** 정의:
>    - **`compact` only**: KTable backing, configuration, saga state — 영구 보관.
>    - **`compact,delete` (mixed)**: outbox, profile snapshot — 시간 가드 추가.
>    - **`delete`**: event stream / audit log — 기본.
> 2. **표준 config 권장값**:
>    | 의도 | cleanup.policy | retention.ms | delete.retention.ms | min.compaction.lag.ms |
>    |---|---|---|---|---|
>    | KTable backing | compact | (해당 없음) | 1d | 0 |
>    | configuration | compact | (해당 없음) | 90d | 0 |
>    | saga state | compact | (해당 없음) | 1d | 30min |
>    | outbox | compact,delete | 30d | 7d | 1h |
>    | profile snapshot | compact,delete | 30d | 7d | 5min |
> 3. **운영 모니터링**: `cleaner-recopy-percent`, `max-dirty-percent`, `time-since-last-run-ms` JMX metric 알람 등록.
> 4. **broker config**: `log.cleaner.threads = 2` (현재 default 1) — compact 토픽 ≥ 5 시.
>
> **Consequences**:
> - (+) 새 토픽 도입 시 결정 매트릭스로 일관성 확보.
> - (+) 운영 함정 (tombstone 사라짐, segment 폭증) 사전 가드.
> - (-) Strimzi KafkaTopic CR 에 추가 config 필요 — 운영 절차 변경.
> - (-) compact 토픽 운영 학습 곡선.
>
> **Alternatives 검토**:
> - 모든 토픽 delete 유지 — outbox / saga / config 시 디스크 무한 증가. 채택 ❌.
> - 모든 토픽 compact — event stream 의 audit 의미 깨짐. 채택 ❌.
> - per-topic ad-hoc 결정 — 일관성 ↓, drift 위험. 채택 ❌.

---

## 8. 면접 한 줄 답변

### Q. log compaction 과 retention(delete) 의 차이는?

> "retention 은 시간/크기 기준으로 segment 통째로 삭제 — event stream / audit log 에 자연스럽습니다. compaction 은 같은 key 의 record 중 최신만 남기고 옛 것을 정리 — 'entity 의 현재 상태' 보존에 자연스럽습니다. 둘은 직교라 `cleanup.policy=compact,delete` 로 결합도 가능합니다 — outbox 처럼 '최신값 + 30일 후 시간 정리' 패턴에 적합."

### Q. tombstone 의 동작과 함정은?

> "value=null 인 record 가 삭제 마커 (tombstone) 입니다. cleaner 가 같은 key 의 이전 record 를 정리할 때 tombstone 자체는 살려두고, 일정 시간 (`delete.retention.ms`, default 1d) 후 마침내 tombstone 도 정리됩니다. 함정은 새 consumer 가 그 시간 안에 catch-up 못 하면 'key 가 한 번도 존재한 적 없는 것처럼' 보인다는 것 — consumer max lag 의 2x 이상으로 `delete.retention.ms` 설정이 필요합니다."

### Q. min.compaction.lag.ms 의 역할은?

> "record 가 발행된 지 이 시간이 지나기 전엔 cleaner 가 건드리지 않게 보호하는 윈도우입니다. consumer 가 lag 으로 옛 record 를 따라잡고 있을 때 cleaner 가 먼저 정리해버리면 consumer 가 일부 버전을 놓치므로, consumer max lag 의 2x 정도로 잡는 게 표준입니다. default 0 은 즉시 정리 가능 — feature flag 처럼 lag 가 거의 없는 토픽에서만 안전합니다."

### Q. mixed (compact,delete) 정책이 적합한 케이스는?

> "outbox topic 이 대표적입니다. compact 로 같은 aggregate 의 옛 publish marker 는 정리하면서, delete 의 retention 으로 30일 지나면 시간 기반으로 옛 outbox 흔적을 정리합니다. compact only 는 영구 보존이라 디스크가 무한 증가하지만, mixed 는 가드가 있어 안전합니다."

### Q. compaction 이 active segment 에는 적용 안 되는 이유는?

> "active segment 는 producer 가 계속 write 중이라 in-memory state 가 disk 와 동기화돼 있지 않을 수 있어, cleaner 가 다시 쓰는 동안 record 가 추가되면 race 가 발생합니다. cleaner 는 segment.ms 또는 segment.bytes 로 close 된 segment 만 처리합니다. 그래서 compact 토픽도 active 영역까지는 같은 key 의 옛 버전을 read 할 수 있습니다."

### Q. KTable 의 backing topic 이 compact 인 이유는?

> "KTable 은 key → 현재 aggregated value 를 표현하는 table 모델입니다. Streams 가 재시작될 때 state store 를 빠르게 복원하려면 'key 별 최신값' 만 보관해도 충분하고, 옛 record 는 의미가 없습니다. compact 가 정확히 이 의미라 backing topic 의 default policy 입니다. tombstone 은 entity 삭제 (DELETE event) 를 표현."

### Q. compaction 운영 함정 3 가지는?

> "1) `delete.retention.ms` 너무 짧으면 tombstone 사라짐 → 새 consumer 가 삭제 사실을 모름. 2) `segment.ms` 너무 짧으면 작은 segment 수천 개 → broker startup 느려짐. 3) `log.cleaner.threads=1` (default) 인데 compact 토픽 많으면 cleaner 정체 → dirty ratio 가 spike. 셋 다 운영 metric (cleaner-recopy / max-dirty / time-since-last-run) 알람으로 가드 가능."

### Q. msa 에서 compaction 도입 후보 토픽은?

> "현재 모든 토픽이 delete 정책 (event stream) 입니다. 도입 후보 4 가지: outbox.product (mixed), saga.order (compact), config.feature-flags (compact), product.profile (mixed - profile snapshot). 특히 product.profile 은 search:consumer 가 catch-up 시 productId 별 최신 1개만 처리하게 해서 효율을 높일 수 있는데, 기존 product.item.* event stream 과 역할 분담 ADR 이 필요합니다."

---

## 9. 흔한 오해 정정

> **"compact 토픽은 모든 record 가 영구 보관된다"**

- ❌ 같은 key 의 **최신 1개만** 영구 보관. 옛 record 는 cleaner 가 정리.

> **"tombstone 을 발행하면 즉시 삭제된다"**

- ❌ tombstone 도 일반 record 처럼 segment 에 쓰이고, cleaner 가 다음 cycle 에 처리. `delete.retention.ms` 동안은 read 가능.

> **"compact 와 delete 는 둘 중 하나만 선택"**

- ❌ `cleanup.policy=compact,delete` (mixed) 가능. outbox 패턴의 표준.

> **"compaction 이 빠른 만큼 디스크가 빨리 정리된다"**

- ⚠ cleaner 는 비동기 — `min.cleanable.dirty.ratio` 도달 후 cleaner thread 가 처리. 즉시 효과 ❌.

> **"min.compaction.lag.ms 가 0 이라 항상 안전하다"**

- ❌ 0 이면 막 발행된 record 도 정리 대상. lag 큰 consumer 가 못 따라잡으면 record 놓침.

> **"compact 토픽은 retention.ms 무관"**

- ⚠ `cleanup.policy=compact` only 면 무관. `compact,delete` mixed 면 retention.ms 도 동시에 적용.

> **"KTable backing topic 은 자동으로 RF=3 으로 복제된다"**

- ⚠ Streams 의 default replication.factor 설정에 따름 (`replication.factor` config). 명시 안 하면 broker default. msa 처럼 default 가 1 인 환경에선 명시 필요.

> **"tombstone 의 key 만 보내고 value 는 빈 문자열로 보내도 된다"**

- ❌ 빈 문자열 ≠ null. **value=null 만** tombstone. 직렬화 시 null 보장 필수.

> **"compaction 이 트랜잭션과 충돌한다"**

- ❌ transactional producer + compact 토픽 동작 OK. abort 된 record 도 정상 정리.

---

## 10. 회독 체크리스트

> §16 회독 체크리스트:
> - [ ] retention (delete) vs compaction 의 직교성 + cleanup.policy 3 종 (delete / compact / compact,delete)
> - [ ] cleaner 의 head/tail (dirty/clean) 모델 + dirty ratio trigger
> - [ ] cleaner thread 동작 7 단계 (dirty ratio → load map → re-write segment)
> - [ ] tombstone 의 lifecycle: segment.ms 후 close → cleaner 가 옛 record 정리 (tombstone 살림) → delete.retention.ms 후 tombstone 도 정리
> - [ ] min.compaction.lag.ms / max.compaction.lag.ms / delete.retention.ms 의 의미 차이
> - [ ] active segment 는 compact 대상 ❌ (race 회피) → 같은 key 의 옛 record 가 active 영역에선 read 됨
> - [ ] 4 가지 운영 패턴: KTable backing, outbox, saga state, configuration
> - [ ] mixed (compact,delete) 의 의미 — compact 의 영구 보존 + delete 의 시간 가드
> - [ ] 운영 함정 5 가지: tombstone 사라짐, segment 폭증, cleaner 정체, lag 너무 짧음, dirty ratio 너무 높음
> - [ ] msa 의 도입 후보: outbox / saga / config / product profile
> - [ ] JMX metric 알람: cleaner-recopy-percent, max-dirty-percent, time-since-last-run-ms

---

## 11. 운영 시나리오 — 5 가지 디버깅 케이스

### 11-1. 케이스 A: tombstone 을 발행했는데 consumer 가 여전히 옛 값 보임

```
[증상]
producer: send(key="user-42", value=null) at t=0
consumer A 가 t=10s 에 read 하면 user-42 의 옛 값을 받음

[진단]
- active segment 의 record 는 compact 안 됨 (cleaner 가 안 건드림)
- segment.ms 가 안 지난 segment 의 record 도 그대로

[정상 동작]
- compact 는 비동기 — 즉시 사라지지 않음
- tombstone 도 일반 record 처럼 segment 에 쓰이고, cleaner 가 다음 cycle 에 처리
- consumer 가 tombstone 자체를 보면 "삭제 됐다" 를 알 수 있음 (value=null 처리)
```

→ "tombstone 은 즉시 삭제" 가 아니라 "삭제 신호" 임을 이해.

### 11-2. 케이스 B: 디스크 사용량이 갑자기 spike

```
[증상]
broker disk usage 가 24h 안에 30% → 80% 로 spike

[진단]
- compact 토픽의 dirty ratio 확인: kafka.log:type=LogCleanerManager,name=max-dirty-percent
- cleaner thread 가 정체됐는지: kafka.log:type=LogCleaner,name=time-since-last-run-ms

[원인 후보]
1. log.cleaner.threads = 1 (default), compact 토픽 ≥ 5 → cleaner 가 못 따라잡음
2. min.cleanable.dirty.ratio = 0.9 같이 높아서 trigger 안 됨
3. 갑자기 producer rate ↑ (event burst)
4. cleaner thread 가 죽음 (dead-thread-count ≥ 1)

[처방]
- log.cleaner.threads ↑ (broker CPU core 의 1/4)
- dirty ratio 낮춤 (0.5 → 0.3)
- max.compaction.lag.ms 설정 (강제 trigger)
```

### 11-3. 케이스 C: 새 consumer 가 old data 를 못 받음

```
[증상]
새 group 으로 t=0 부터 consume 했는데 user-42 가 한 번도 안 보임
(실제로는 user-42 에 대해 t=-30d 에 tombstone 발행 후 t=-25d 에 정리됨)

[원인]
- tombstone 의 lifecycle: segment.ms 후 close → cleaner 가 옛 record + tombstone 정리 (delete.retention.ms 후)
- 30 일 전 tombstone 이 이미 정리되어 새 consumer 입장에선 "user-42 가 한 번도 존재한 적 없는" 상태

[처방]
- delete.retention.ms 를 max consumer lag × 2 이상으로
- snapshot + replay 패턴 (offline batch 가 가끔 새 group 만들면 더 길게)
```

### 11-4. 케이스 D: Streams 의 changelog 가 너무 큼

```
[증상]
analytics-streams 의 changelog topic disk 사용량이 1TB 넘음
restart 시 state 복원에 30 분 걸림

[진단]
- changelog 의 cleanup.policy = compact 인지 확인
- min.cleanable.dirty.ratio 확인
- KTable 의 unique key 수 확인 (= 정상 changelog 크기 lower bound)

[원인 후보]
1. cleanup.policy = delete (잘못 설정)
2. compact 인데 cleaner 가 정체
3. KTable 의 key cardinality 가 너무 큼 (예: 매 event 가 unique key)

[처방]
- cleanup.policy = compact 명시
- min.cleanable.dirty.ratio = 0.3 (자주 정리)
- key cardinality 줄이기 — windowing / bucketing 으로 key 수 제한
- standby replica 도입 (restart 시 즉시 promote)
```

### 11-5. 케이스 E: outbox 가 30 일 후에도 안 사라짐

```
[증상]
outbox topic 에 30 일 전 record 가 여전히 read 가능

[진단]
- cleanup.policy = compact,delete 인지 확인
- retention.ms = 30d 설정 됐는지 확인
- 같은 key 에 대해 최근 publish 가 있어 retention 의 의미가 달라졌는지

[원인]
- compact only 라 시간 가드 없음
- 또는 같은 key 의 새 publish 가 활성 segment 에 있어 옛 segment 가 안 닫힘

[처방]
- mixed 정책 명시 (compact,delete + retention.ms)
- segment.ms 적정 설정 (1d 권장)
```

---

## 12. 코드 분석 — msa Strimzi KafkaTopic CR 의 권장 변경

### 12-1. 현재 (`k8s/infra/prod/strimzi/kafka-topics.yaml`)

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: product.item.created
spec:
  partitions: 6
  replicas: 3
  config:
    retention.ms: "604800000"      # 7d
    min.insync.replicas: "2"
    # cleanup.policy 미명시 → default = delete
```

### 12-2. 신규 outbox 토픽 도입 시 권장 CR

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: outbox.product
  namespace: commerce
  labels:
    strimzi.io/cluster: commerce
spec:
  partitions: 6
  replicas: 3
  config:
    cleanup.policy: "compact,delete"
    retention.ms: "2592000000"            # 30d
    delete.retention.ms: "604800000"      # 7d
    min.compaction.lag.ms: "3600000"      # 1h
    max.compaction.lag.ms: "86400000"     # 1d (강제 trigger)
    segment.ms: "86400000"                # 1d
    min.cleanable.dirty.ratio: "0.3"      # 자주 정리
    min.insync.replicas: "2"
```

### 12-3. saga state 토픽 권장 CR

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: saga.order
  namespace: commerce
  labels:
    strimzi.io/cluster: commerce
spec:
  partitions: 6
  replicas: 3
  config:
    cleanup.policy: "compact"
    delete.retention.ms: "86400000"       # 1d
    min.compaction.lag.ms: "1800000"      # 30min
    segment.ms: "86400000"                # 1d
    min.cleanable.dirty.ratio: "0.3"
    min.insync.replicas: "2"
```

### 12-4. configuration 토픽 권장 CR (1 partition)

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: config.feature-flags
  namespace: commerce
  labels:
    strimzi.io/cluster: commerce
spec:
  partitions: 1                           # ordering 보장
  replicas: 3
  config:
    cleanup.policy: "compact"
    delete.retention.ms: "7776000000"     # 90d (감사 history)
    min.compaction.lag.ms: "0"
    segment.ms: "604800000"               # 7d (작은 데이터라 길게)
    min.insync.replicas: "2"
```

### 12-5. broker config 변경 (compact 토픽 ≥ 5 도입 시)

Strimzi Kafka CR (`k8s/infra/prod/strimzi/kafka-cluster.yaml`):

```yaml
spec:
  kafka:
    config:
      # ... 기존 설정 ...
      log.cleaner.threads: 2              # default 1 → 2
      log.cleaner.dedupe.buffer.size: "134217728"   # 128MB (default), 큰 store 면 ↑
      log.cleaner.io.buffer.size: "524288"          # 512KB (default)
```

### 12-6. 검증 절차

```bash
# 1. KafkaTopic CR 적용
kubectl apply -f outbox-topic.yaml

# 2. Topic config 확인
kafka-configs.sh --bootstrap-server kafka:29092 \
    --entity-type topics --entity-name outbox.product --describe

# 3. cleanup.policy / retention.ms 확인
# 출력에 "cleanup.policy=compact,delete", "retention.ms=2592000000" 보여야 함

# 4. compact 동작 확인 (며칠 후)
# JMX:
#   kafka.log:type=Log,name=NumLogSegments,topic=outbox.product → segment 수
#   kafka.log:type=LogCleanerManager,name=uncleanable-bytes → 정리 안 된 dirty bytes

# 5. tombstone 발행 후 read 테스트
kafka-console-producer.sh --bootstrap-server kafka:29092 --topic outbox.product \
    --property "parse.key=true" --property "key.separator=:" \
    <<< "user-42:"
# (value 비워두면 tombstone)

kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic outbox.product \
    --from-beginning --property print.key=true
# user-42 의 마지막 record 가 null 인지 확인
```

---

## 13. 연결 학습

- §02 offset / retention / compaction 기본 — 본 문서가 운영 패턴으로 확장
- §05 broker internals — segment 구조 + page cache 와 cleaner I/O 의 상호작용
- §09 exactly-once — transactional + compact 토픽의 abort/commit marker 처리
- §15 (이전) rebalance protocol — `__consumer_offsets` 가 compact 토픽
- §17 (다음) Streams API + KTable — KTable backing topic 이 compact 정책의 1차 사용처
