---
parent: 6-kafka-internals
seq: 02
title: Offset · Retention · Log Compaction
type: deep
created: 2026-05-01
---

# 02. Offset / Retention / Log Compaction — 메시지가 보관되는 방식

## 한 줄 요약

> 파티션은 0부터 단조 증가하는 **offset** 으로 메시지를 식별하는 **append-only 로그**다. 보관은 **retention.ms (시간 기반)** 또는 **log compaction (key 기반 최신값 유지)** 중 선택, 둘을 섞을 수도 있다. 컨슈머는 offset 을 직접 관리한다.

## 1. Offset 의 정확한 정의

- **파티션 단위 0-based 단조 증가 정수**
- 토픽/클러스터 전체에 걸친 글로벌 오프셋 같은 건 없다
- 한 번 부여된 offset 은 **불변** — segment 가 압축되거나 삭제돼도 오프셋 번호는 재사용 안 됨
- 파티션 한도: signed long 즉 약 9.2 × 10^18 (사실상 무한)

```
Partition 0 of order.order.completed:
┌────┬────┬────┬────┬────┬────┬────┐
│ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ ...│  ← offset
└────┴────┴────┴────┴────┴────┴────┘
            ▲       ▲
            │       │
            │       Latest committed offset (LSO)
            │
            컨슈머 그룹 A 의 commit position
```

## 2. Producer 가 offset 을 받는 시점

```kotlin
val future = kafkaTemplate.send("order.order.completed", "1001", payload)
val result: SendResult<String, Any> = future.get()
val recordMetadata = result.recordMetadata
println(recordMetadata.offset())     // ack 후 broker 가 부여한 offset
println(recordMetadata.partition())
```

- offset 은 **broker 가 부여** → producer 는 ack 받기 전엔 모름
- `acks=0` 이면 offset 도 받지 못함 (그냥 fire-and-forget)

## 3. __consumer_offsets 토픽

Kafka 내부 토픽으로, 컨슈머 그룹의 오프셋 커밋이 기록되는 곳.

```
Topic: __consumer_offsets (50 파티션, RF=3, log.cleanup.policy=compact)

key:   (group.id, topic, partition)
value: (offset, metadata, timestamp)
```

- **compact** 정책이라 같은 key 의 최신값만 남는다 (옛날 commit 은 정리됨)
- 파티션 수는 `offsets.topic.num.partitions` (기본 50, msa local 은 1)
- group.id 의 hash 로 어느 파티션에 갈지 결정 → 각 그룹마다 **Group Coordinator** 가 자동 결정됨

```bash
# 현재 그룹의 offset 조회
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group inventory-service --describe
```

출력:
```
GROUP             TOPIC                   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
inventory-service order.order.completed   0          1523            1525            2
inventory-service order.order.completed   1          1601            1601            0
inventory-service order.order.completed   2          1480            1485            5
```

- **LAG** = LOG-END-OFFSET - CURRENT-OFFSET (밀린 메시지 수)
- 운영 알람: lag > 임계치 / 일정 기간 lag 비감소

## 4. Retention (시간/크기 기반)

기본 정책 — **오래된 메시지 삭제**.

| 설정 | 의미 | 기본값 |
|---|---|---|
| `retention.ms` | 보관 시간 | 7d (broker default `log.retention.hours=168`) |
| `retention.bytes` | 파티션 당 최대 크기 | -1 (무제한) |
| `segment.ms` | 활성 segment 최대 시간 | 7d |
| `segment.bytes` | segment 파일 최대 크기 | 1GB |

**삭제 단위는 segment**. retention 만료된 segment 가 통째로 삭제된다.

```
파티션 0 디렉토리:
00000000000000000000.log    ← segment 0 (가장 오래된 → 삭제 대상)
00000000000000150000.log    ← segment 1
00000000000000300000.log    ← segment 2 (활성 — 추가 중)
```

retention.ms = 7d 라면, 8일 된 segment 0 은 통째로 unlink. 안에 있던 메시지 모두 사라짐.

## 5. Log Compaction (key 기반 최신값 유지)

`cleanup.policy=compact` 토픽은 **같은 key 의 최신값만 남기는 방식**으로 정리된다. 시간이 지나도 데이터 자체는 사라지지 않는 게 핵심.

```
Before compaction:
offset 0: key=user1, value={name:"A"}
offset 1: key=user2, value={name:"B"}
offset 2: key=user1, value={name:"A2"}    ← user1 최신
offset 3: key=user1, value={name:"A3"}    ← user1 최최신
offset 4: key=user3, value={name:"C"}

After compaction (offset 2, 0 삭제):
offset 1: key=user2, value={name:"B"}
offset 3: key=user1, value={name:"A3"}
offset 4: key=user3, value={name:"C"}
```

- offset 은 그대로 (1, 3, 4) — 압축돼도 재할당 안 됨
- value=`null` 메시지를 보내면 **tombstone** 으로 처리되어 그 key 의 모든 메시지가 삭제됨

**용도**:
- **changelog topic** (Kafka Streams 내부 state store 백업)
- **__consumer_offsets** (그래서 compact)
- DB CDC 의 마지막 상태 보관
- 캐시 유사 패턴

**Compact + Delete 섞기**:
```
cleanup.policy=compact,delete
retention.ms=2592000000   # 30일 후엔 압축본도 삭제
```

→ "최신값만 유지하되 30일 지난 건 어차피 의미 없으니 정리" — Kafka Streams 내부 changelog 가 이 패턴.

## 6. Tombstone 과 삭제 시점

```
1. 사용자가 key=user1, value=null 발행
2. compact 작업이 돌면 user1 의 이전 메시지들 삭제
3. tombstone 자체도 delete.retention.ms (기본 24h) 후 삭제
   → 그 사이 컨슈머는 "user1 삭제됨" 신호를 받을 기회가 있음
```

`delete.retention.ms` 가 너무 짧으면 컨슈머가 tombstone 을 못 보고 캐시에 stale 데이터 유지될 수 있음. 다운스트림 처리 SLA 보다 길게 잡아야 함.

## 7. Offset Reset 정책

신규 그룹이 처음 토픽을 구독하거나, 커밋된 오프셋이 retention 으로 사라졌을 때:

```yaml
# msa inventory KafkaConfig.kt 발췌
ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest"
```

| 값 | 동작 | 사용처 |
|---|---|---|
| `earliest` | 가장 오래된 메시지부터 | 이벤트 재처리 / 신규 서비스 catch-up (msa 기본) |
| `latest` | 새로 들어오는 것만 | 실시간 모니터링, 과거 무시 |
| `none` | 예외 throw | 명시적 리셋 강제, 자동 진행 거부 |

**msa 의 trade-off**: `earliest` 라 신규 컨슈머 그룹이 떠도 retention 기간 내 모든 메시지를 다시 받는다 → **멱등성이 필수** (그래서 ADR-0012). 만약 latest 였다면 신규 그룹은 시작 전 이벤트를 영구 누락.

## 8. 시간 기반 lookup (offsets.for.times)

```bash
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group inventory-service \
  --topic order.order.completed \
  --reset-offsets --to-datetime 2026-04-01T00:00:00Z \
  --execute
```

- timestamp index 가 segment 마다 있어서 빠르게 시점 → offset 변환 가능
- 사고 후 특정 시점부터 재처리할 때 사용

## 9. Offset 커밋 함정

자세한 건 `08-offset-commit-poll.md` 에서. 여기선 한 줄:

- **auto commit** + 비동기 처리 = 메시지 처리 전에 commit 이 진행될 수 있음 → at-most-once
- **manual commit (after process)** = 처리 후 commit, 단 commit 전 죽으면 재처리 → at-least-once
- **manual commit (before process)** = 사고 패턴, 절대 금지 → at-most-once 의도적 구현이면 OK 지만 보통 실수

msa 의 모든 KafkaConfig 는:
```kotlin
ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
containerProperties.ackMode = ContainerProperties.AckMode.RECORD,
```

`AckMode.RECORD` 는 "메시지 1건 처리 후 자동 sync commit". 처리 도중 죽으면 같은 메시지가 재전달 → **컨슈머 멱등성** 으로 보호 (ADR-0012 의 processed_event 테이블).

## 10. 면접 포인트

- **Q. Kafka 의 메시지는 영구 보관되는가?**
  > 기본은 아니다. retention.ms (기본 7일) 후 삭제. compact 정책이면 같은 key 최신값은 영구. 영구 보관이 필요하면 retention.ms=-1 또는 Tiered Storage(3.6+)로 S3 같은 외부 스토리지에 offload.

- **Q. Consumer 가 offset 을 잃으면? (예: __consumer_offsets 손상)**
  > auto.offset.reset 으로 결정. earliest 면 처음부터, latest 면 현 시점부터. 데이터 정합성을 지키려면 멱등 컨슈머 + earliest 조합이 안전.

- **Q. Log Compaction 토픽에서 메시지를 삭제하려면?**
  > 같은 key 에 value=null (tombstone) 을 발행. compact 작업 후 그 key 의 모든 이전 메시지가 사라지고, tombstone 자체도 delete.retention.ms 후 정리.

- **Q. Compaction 이 즉시 반영 안 되는 이유?**
  > compaction 은 **활성 segment 가 아닌 closed segment** 만 대상으로, 백그라운드 cleaner thread 가 주기적으로 돈다. min.cleanable.dirty.ratio (기본 0.5) 이상 dirty 일 때만 작동. 즉 "방금 보낸 tombstone 이 즉시 보이지 않을 수 있다" 는 점이 함정.

## 11. 다음 단계

- [03-controller-kraft.md](03-controller-kraft.md) — 메타데이터(토픽/파티션 정보) 관리
- [05-broker-internals.md](05-broker-internals.md) — segment 파일 / index / page cache
- [08-offset-commit-poll.md](08-offset-commit-poll.md) — Consumer offset commit 심화
