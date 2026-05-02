---
parent: 6-kafka-internals
seq: 08
title: Offset Commit · Poll Loop 함정
type: deep
created: 2026-05-01
---

# 08. Offset Commit / Poll Loop 함정

## 한 줄 요약

> 컨슈머가 어디까지 처리했는지 broker 에 알리는 게 **offset commit**. **언제 commit 하느냐가 at-most-once / at-least-once 를 결정**. msa 는 모두 `enable.auto.commit=false` + `AckMode.RECORD` (Spring 자동 sync commit) → at-least-once + 컨슈머 멱등성으로 보강.

## 1. Offset Commit 의 4가지 패턴

```kotlin
val records = consumer.poll(...)
process(records)            // 비즈니스 처리
consumer.commitSync()       // offset commit
```

처리와 commit 의 순서/방식 조합:

| 패턴 | 처리 ↔ commit 순서 | 시맨틱 | 사용처 |
|---|---|---|---|
| auto-commit | 백그라운드 주기 (5s 기본) | 약속 못 함 (대개 at-least-once) | 비추 |
| manual sync (after) | 처리 → commit | at-least-once | **msa 표준** |
| manual sync (before) | commit → 처리 | at-most-once | 메시지 손실 허용 |
| async commit | 처리 → commit (non-blocking) | at-least-once + 일부 누락 위험 | 고성능 |

## 2. enable.auto.commit 의 함정

```yaml
enable.auto.commit: true
auto.commit.interval.ms: 5000
```

- 백그라운드 thread 가 5초마다 마지막 poll 의 offset 을 자동 commit
- **위험**: 처리가 오래 걸리는 동안 commit 이 먼저 진행될 수 있음

```
t=0: poll(), 100건 받음 (offset 100~199)
t=2: 50건 처리 (offset 100~149)
t=5: auto commit → offset 200 까지 commit (poll 받은 끝까지)
t=10: 처리 중 컨슈머 죽음
복구: 새 컨슈머 → offset 200 부터 시작 → offset 150~199 누락!
```

**at-most-once 가 의도면 OK** 지만, 보통은 사고. 그래서 msa 는 모두 `false`.

## 3. Manual Sync Commit (msa 표준 — Spring AckMode.RECORD)

```kotlin
// inventory KafkaConfig.kt
containerProperties.ackMode = ContainerProperties.AckMode.RECORD
```

`AckMode.RECORD` 의미: **메시지 1건 처리 후 자동 sync commit**. Spring Kafka 가 알아서 해줌.

```kotlin
@KafkaListener(...)
fun onOrderCompleted(record: ConsumerRecord<String, String>) {
    // 비즈니스 처리 (성공해야 함)
    val event = parse(record.value())
    reserveStockUseCase.execute(...)
    // 메서드 끝 = Spring 이 자동 commitSync()
}
```

- 처리 중 예외 발생 → commit 안 됨 → 다음 poll 에서 같은 메시지 재전달 (DLQ 재시도 정책으로 처리)
- 정상 처리 → commit → offset 진행

**at-least-once + 컨슈머 멱등성** 으로 effectively-once 달성 (ADR-0012).

## 4. AckMode 의 종류 (Spring Kafka)

| AckMode | 동작 |
|---|---|
| `RECORD` | 매 메시지 처리 후 sync commit (msa 기본) |
| `BATCH` | poll() 1회 처리 후 commit |
| `TIME` | ackTime 마다 |
| `COUNT` | ackCount 누적 후 |
| `COUNT_TIME` | 둘 중 먼저 만족 |
| `MANUAL` | 코드에서 `ack.acknowledge()` 호출 |
| `MANUAL_IMMEDIATE` | 호출 즉시 commit |

`RECORD` 는 **가장 안전하지만 가장 느림** (commit 마다 sync 호출). 트래픽 많으면 `BATCH` 고려, 단 batch 처리 중 부분 실패 처리 복잡.

## 5. Poll Loop 의 함정 — max.poll.records / max.poll.interval.ms

```kotlin
// poll → process → commit 사이클
while (true) {
    val records = consumer.poll(Duration.ofMillis(500))
    for (record in records) {
        process(record)      // 처리 시간 오래 걸리면 위험
    }
    consumer.commitSync()
}
```

`max.poll.records` (default 500) 만큼 한번에 받음. 처리 시간 N ms 이면:
```
poll 1회의 처리 시간 ≈ N × 500 ms
이게 max.poll.interval.ms (default 5분) 를 넘으면 → rebalance
```

**시나리오**:
- 외부 API 호출 1건당 1초
- max.poll.records=500 → 1 poll = 500초 처리 → max.poll.interval.ms 초과 → 그룹에서 제외 → rebalance → 다른 컨슈머가 같은 메시지 처리 → 무한 루프

**해결**:
1. `max.poll.records` 줄이기 (예: 100)
2. `max.poll.interval.ms` 늘리기 (예: 10분)
3. 처리를 비동기 worker 에 dispatch 후 즉시 poll() 복귀 (단, offset commit 시점 관리 복잡)

## 6. Async Commit 패턴

```kotlin
consumer.commitAsync { offsets, exception ->
    if (exception != null) log.warn("commit failed: $offsets", exception)
}
```

**장점**: blocking 안 함 → throughput ↑

**위험**:
- 비동기 commit 응답 도착 전 다음 commit 이 더 작은 offset 으로 진행될 수 있음 (out-of-order)
- 마지막 commit 만 성공하면 결과적 정합 OK 인데, 실패 시 안전 장치 필요

**관용 패턴**: 평소엔 async, **shutdown / 정기적 sync** 로 보강.

```kotlin
try {
    while (running) {
        val records = consumer.poll(...)
        process(records)
        consumer.commitAsync()
    }
} finally {
    try {
        consumer.commitSync()  // 마지막엔 sync
    } finally {
        consumer.close()
    }
}
```

## 7. 부분 처리 후 commit (정밀 제어)

`ConsumerRecords` 안에서 일부만 성공 + 나머지는 retry 시:

```kotlin
val records = consumer.poll(...)
val offsets = mutableMapOf<TopicPartition, OffsetAndMetadata>()
for (record in records) {
    try {
        process(record)
        offsets[TopicPartition(record.topic(), record.partition())] =
            OffsetAndMetadata(record.offset() + 1)  // +1 이 다음 처리할 offset
    } catch (e: Exception) {
        consumer.commitSync(offsets)   // 성공한 부분까지만 commit
        consumer.seek(record.topicPartition, record.offset())  // 실패 위치로 되돌리기
        throw e
    }
}
consumer.commitSync(offsets)
```

→ 복잡함. 보통은 Spring Kafka 의 `DefaultErrorHandler` + DLQ 가 이 역할 대신 해 줌.

## 8. msa Consumer 의 처리 흐름 (실제 코드)

```kotlin
// inventory/.../InventoryEventConsumer.kt
@KafkaListener(
    topics = ["order.order.completed"],
    groupId = "inventory-service",
    containerFactory = "kafkaListenerContainerFactory",
)
fun onOrderCompleted(record: ConsumerRecord<String, String>) {
    log.info("Received order.order.completed: key={}", record.key())

    val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)

    // [1] 멱등성 체크
    if (event.eventId.isNotBlank() && processedEventRepository.existsById(event.eventId)) {
        log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
        return  // → return 후 메서드 끝나면 자동 commit
    }

    // [2] 비즈니스 처리
    for (item in event.items) {
        reserveStockUseCase.execute(...)
    }

    // [3] 멱등 마킹 (같은 트랜잭션은 아니지만 — 개선 후보)
    if (event.eventId.isNotBlank()) {
        processedEventRepository.save(ProcessedEventJpaEntity(event.eventId, "order.order.completed"))
    }

    // [4] 메서드 종료 → Spring 이 sync commit
}
```

**경로 분석**:
- 정상: 처리 → 마킹 → commit (idempotent INSERT 가 같은 트랜잭션 안에 있어야 100% 안전, 현재는 분리 — 사고 시 마킹 안 되고 commit 만 되면 다음 처리에서 중복 INSERT — 다행히 PK 충돌로 막힘)
- 처리 중 예외: commit 안 됨 → DefaultErrorHandler 가 1초 간격 3번 재시도 → DLQ 로 송부

**개선 후보** (`13-improvements.md`):
- 비즈니스 트랜잭션 안에 processed_event INSERT 함께 (atomic)
- Spring TX + KafkaTransactionManager 로 EOS 시도

## 9. ackTime / ackCount 패턴

트래픽 많은 토픽에서 RECORD 마다 sync commit 이 부담:

```kotlin
containerProperties.ackMode = ContainerProperties.AckMode.COUNT_TIME
containerProperties.ackCount = 100   // 100 건마다
containerProperties.ackTime = 5000   // 5초마다
```

→ 100 건 또는 5초 후 commit. **장애 시 최대 100건 재처리** — 멱등성 강화 필요.

## 10. 면접 포인트

- **Q. enable.auto.commit=true 가 위험한 이유?**
  > 백그라운드 thread 가 자동 commit 하므로 처리 안 끝났는데 commit 이 진행될 수 있음 → 컨슈머 죽으면 메시지 누락. 의도가 at-most-once 일 때만 안전. 보통 false 로 두고 처리 후 명시 commit.

- **Q. AckMode.RECORD vs BATCH 의 트레이드오프?**
  > RECORD: 매 메시지 sync commit → 안전, 느림. BATCH: poll 1회 후 commit → 빠름, batch 중 부분 실패 처리 복잡. 메시지 양이 많고 처리가 빠른 토픽 (예: 로그) 은 BATCH, 도메인 이벤트는 RECORD.

- **Q. max.poll.records 와 max.poll.interval.ms 의 관계?**
  > 한 poll 의 처리 시간 ≤ max.poll.interval.ms 여야 rebalance 안 일어남. 처리 시간 1초 / 메시지, max.poll.interval.ms=300_000 → max.poll.records ≤ 300. 안 그러면 무한 rebalance 루프.

- **Q. Spring Kafka 에서 처리 도중 예외 발생하면?**
  > offset commit 안 됨 → 같은 메시지 재전달. DefaultErrorHandler 가 재시도 정책 (FixedBackOff 1s × 3) 적용 후 DLQ 로 보냄. msa 의 ADR-0015 표준.

- **Q. async commit 으로 throughput 올리고 싶은데 안전한 패턴?**
  > 평소엔 commitAsync, 정기적으로 (예: 매 1000건마다) 또는 shutdown hook 에서 commitSync. 마지막 commit 이 성공하면 그 이전 async commit 들의 누락은 결과적으로 보정됨. 다만 비즈니스 멱등성이 강하지 않으면 권장 안 함.

## 11. 다음 단계

- [09-exactly-once.md](09-exactly-once.md) — Producer Tx + Consumer read_committed 로 EOS
- [10-idempotency-dlq-failure.md](10-idempotency-dlq-failure.md) — at-least-once + 멱등 → effectively-once
- [11-msa-codebase-grep.md](11-msa-codebase-grep.md) — msa 의 실제 commit 패턴 종합
