---
parent: 6-kafka-internals
seq: 11
title: msa 코드베이스 Kafka 사용 전수조사
type: deep
created: 2026-05-01
---

# 11. msa Kafka 사용처 전수조사

## 한 줄 요약

> msa 의 모든 서비스 Kafka 사용처를 grep + 직접 읽어 정리. **Producer 표준 (acks=all + idempotence + max.in.flight=5 + delivery.timeout=120s)** 은 일관됨. **Consumer 멱등성 (processed_event)** 은 inventory/order/quant 적용. **DLQ (Dead Letter Queue, 데드 레터 큐) 정책 (FixedBackOff 1s × 3 + DLT 접미사)** 일관. 단점은 Outbox 패턴 부분 적용 (inventory/fulfillment/quant) + Cooperative-Sticky / group.instance.id 미설정.

## 1. 서비스 별 사용 매트릭스

| 서비스 | Producer | Consumer | 멱등 패턴 | DLQ | Outbox | Streams |
|---|---|---|---|---|---|---|
| order | acks=all + idempotence | inventory.reservation.expired | processed_event | DLT | (없음, 직접 발행) | - |
| inventory | acks=all + idempotence | order/fulfillment 토픽 (3 토픽) | processed_event | DLT | ✓ Outbox SSOT | - |
| fulfillment | acks=all + idempotence | inventory.stock.reserved | processed_event | DLT | ✓ Outbox SSOT | - |
| search | (없음) | product.item.* | ES doc id 자연 멱등 | DLT | - | - |
| analytics | KStream output | analytics.event.collected | (없음 — Streams) | (Streams) | - | ✓ |
| wishlist | (없음) | product.deleted, member.withdrawn | DELETE 자연 멱등 | (TBD) | - | - |
| quant | OutboxRelay (Phase 2) | (Phase 3 외부 통합 시) | IdempotentEventConsumer | DLT | ✓ OutboxRelay | - |

## 2. Producer 설정 일관성 검증

### 표준 셋 (kafka-convention.md 기반)

```kotlin
ProducerConfig.ACKS_CONFIG to "all",
ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000,
ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
// VALUE_SERIALIZER: JacksonJsonSerializer
```

### 실제 코드 — 일치 (3개 서비스)

`order/app/src/main/kotlin/com/kgd/order/infrastructure/config/KafkaConfig.kt` (실제 패키지: `com.kgd.order.config` — module-structure 다이얼렉트, 모듈 경계 강제 안 됨):
```kotlin
ProducerConfig.ACKS_CONFIG to "all",
ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000,
```

`inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt` — 동일.
`fulfillment` — 동일 (Outbox 발행)

→ **3개 서비스 producer 설정 완전 동일**. 표준 일관.

### 누락된 권장 설정
- `linger.ms`, `batch.size` — 기본값 (0, 16KB) 사용 → 트래픽 증가 시 튜닝 후보
- `compression.type` — 기본 none → JSON 페이로드 lz4 권장
- `transactional.id` — 미사용 (Outbox 패턴이 대안)

## 3. Consumer 설정 일관성

### 표준 셋

```kotlin
ConsumerConfig.GROUP_ID_CONFIG to "inventory-service",  // {service}-{purpose}
ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
// AckMode.RECORD (Spring 자동 sync commit)
```

### Group ID 컨벤션 검증

`docs/architecture/kafka-convention.md` 명시: `{service}-{purpose}`

실제:
| 서비스 | groupId | 컨벤션 부합 |
|---|---|---|
| inventory | `inventory-service` | ✓ |
| order | `order-service` | ✓ |
| analytics ingestion | `analytics-event-ingestion` | ✓ |
| analytics streams | `analytics-streams` (application.id) | ✓ |
| wishlist product | `wishlist-product-cleanup` | ✓ |
| wishlist member | `wishlist-member-cleanup` (`wishlist/app/src/main/kotlin/com/kgd/wishlist/infrastructure/consumer/MemberEventConsumer.kt:20`) | ✓ |
| quant | `quant-notification` 등 (Phase 3) | ✓ |

→ 일관됨.

### 누락된 권장 설정
- `partition.assignment.strategy=CooperativeStickyAssignor` — 모두 미설정 (기본 Range)
- `group.instance.id` — 모두 미설정 (K8s rolling restart 시 매번 rebalance)
- `max.poll.records`, `max.poll.interval.ms` — 명시 없음 (기본값)
- `isolation.level=read_committed` — EOS 미사용이므로 기본 read_uncommitted (현 시점 OK)

## 4. DLQ 설정 일관성

### 표준 (ADR-0015)

```kotlin
containerProperties.ackMode = ContainerProperties.AckMode.RECORD
setCommonErrorHandler(
    DefaultErrorHandler(
        DeadLetterPublishingRecoverer(kafkaTemplate),
        FixedBackOff(1000L, 3L),
    )
)
```

### 실제

`order`, `inventory`, `fulfillment`, `quant` — 모두 동일 패턴. 단 quant 은 별도 `KafkaConsumerErrorHandlerConfiguration` 으로 분리 + `@ConditionalOnProperty(name = ["spring.kafka.bootstrap-servers"])` 로 Phase 1 backtest-only 환경 보호:

```kotlin
// quant/.../KafkaConsumerErrorHandlerConfiguration.kt
@Configuration
@ConditionalOnProperty(
    name = ["spring.kafka.bootstrap-servers"],
    matchIfMissing = false,
)
class KafkaConsumerErrorHandlerConfiguration {
    @Bean
    fun defaultErrorHandler(kafkaTemplate: KafkaTemplate<String, String>): DefaultErrorHandler {
        val recoverer = DeadLetterPublishingRecoverer(kafkaTemplate) { record, _ ->
            TopicPartition(record.topic() + DLT_SUFFIX, record.partition())
        }
        return DefaultErrorHandler(recoverer, FixedBackOff(BACKOFF_INTERVAL_MS, MAX_RETRIES))
    }

    companion object {
        const val DLT_SUFFIX: String = ".DLT"
        const val BACKOFF_INTERVAL_MS: Long = 1_000L
        const val MAX_RETRIES: Long = 3L
    }
}
```

→ **quant 의 패턴이 더 깔끔** (상수화 + Conditional 보호). 다른 서비스도 이 패턴으로 통일 가능 (`13-improvements.md`).

## 5. 멱등 Consumer 패턴 검증 (ADR-0012)

### Inventory — 가장 명확한 사례

```kotlin
// inventory/.../InventoryEventConsumer.kt
@KafkaListener(topics = ["order.order.completed"], groupId = "inventory-service")
fun onOrderCompleted(record: ConsumerRecord<String, String>) {
    val event = objectMapper.readValue(record.value(), OrderCompletedEvent::class.java)

    // [1] 멱등 체크
    if (event.eventId.isNotBlank() && processedEventRepository.existsById(event.eventId)) {
        log.info("Duplicate event detected, skipping: eventId={}", event.eventId)
        return
    }

    // [2] 비즈니스 처리
    for (item in event.items) {
        reserveStockUseCase.execute(...)
    }

    // [3] 마킹
    if (event.eventId.isNotBlank()) {
        processedEventRepository.save(ProcessedEventJpaEntity(event.eventId, "order.order.completed"))
    }
}
```

**3개 핸들러 (`onOrderCompleted`, `onFulfillmentShipped`, `onFulfillmentCancelled`) 모두 동일 구조**.

### Order — 동일 패턴
```kotlin
// order/.../OrderEventConsumer.kt
fun onReservationExpired(record: ConsumerRecord<String, String>) {
    val node = objectMapper.readTree(record.value())
    val eventId = node.get("eventId")?.asText() ?: ""
    if (eventId.isNotBlank() && processedEventRepository.existsById(eventId)) return
    // 처리 → 마킹
}
```

### Quant — IdempotentEventConsumer 헬퍼 (가장 깔끔)

```kotlin
// quant/.../IdempotentEventConsumer.kt
fun process(eventId: UUID, consumerGroup: String, block: () -> Unit): Boolean {
    val pk = ProcessedEventId(eventId, consumerGroup)
    if (processedEventRepo.existsById(pk)) return false
    block()
    return try {
        transactionTemplate.execute {
            processedEventRepo.save(ProcessedEventEntity(eventId, consumerGroup, Instant.now()))
        }
        true
    } catch (e: DataIntegrityViolationException) {
        // PK conflict — concurrent insert. biz already done. OK.
        true
    }
}
```

**개선점**: quant 은 `(eventId, consumerGroup)` 복합 키로 멱등성을 더 강화. 같은 event 가 여러 그룹에 가도 그룹마다 별도 처리 가능 (멀티 컨슈머 안전).

## 6. Outbox 패턴 비교

### Inventory (간단한 Polling)
```kotlin
// inventory/.../OutboxPollingPublisher.kt
@Scheduled(fixedDelayString = "1000")
fun publishPendingEvents() {
    val events = outboxRepository.findAllByStatusOrderByCreatedAtAsc("PENDING")
    for (event in events) {
        kafkaTemplate.send(event.eventType, event.aggregateId.toString(), enrichedPayload)
            .whenComplete { _, ex ->
                if (ex == null) {
                    event.status = "PUBLISHED"
                    outboxRepository.save(event)
                }
            }
    }
}
```

- aggregateId 를 partition key 로 사용 (도메인 단위 순서 보장 ✓)
- async callback 으로 status 업데이트
- ⚠️ kafkaTemplate.send 결과를 `whenComplete` 비동기로 처리 → 다음 polling 루프 시작 시 이전 send 가 아직 진행 중일 수 있음. 안전하지만 race 가능성.

### Quant (TransactionTemplate + batch markPublished)
```kotlin
// quant/.../OutboxRelay.kt
@Scheduled(fixedDelay = POLL_INTERVAL_MS)  // 1000ms
fun relay() {
    val batch = outboxRepo.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc()
    val publishedEventIds = mutableListOf<UUID>()
    for (entity in batch) {
        try {
            template.send(topic, entity.eventId.toString(), entity.payload)
                .get(publishTimeoutSeconds, TimeUnit.SECONDS)   // sync wait
            publishedEventIds.add(entity.eventId)
            metrics.outboxPublished(topic)
        } catch (e: Exception) {
            metrics.outboxPublishFailed(topic)
        }
    }
    if (publishedEventIds.isNotEmpty()) {
        transactionTemplate.execute {
            outboxRepo.markPublished(publishedEventIds, Instant.now())
        }
    }
}
```

- `.get()` 으로 sync 대기 → 한 번에 한 개씩 발행 (race 없음)
- batch markPublished (모은 후 한 트랜잭션)
- ⚠️ partition key 가 **eventId** (UUID) → 같은 aggregate 의 이벤트들이 다른 partition 으로 흩어짐 → **순서 보장 안 됨** (Phase 2 단순화)
- `topicMapping(eventType)` 함수가 현재는 모두 default topic 으로 (Phase 2 단순화). 후속 PR 에서 `quant.{aggregate}.{event}.v1` 정밀 매핑 예정.

### 비교 요약

| 항목 | inventory | quant |
|---|---|---|
| 발행 방식 | async (whenComplete) | sync (.get with timeout) |
| partition key | `aggregateId` | `eventId` (UUID) |
| 도메인 순서 보장 | ✓ | ✗ (Phase 2 한정) |
| 토픽 매핑 | eventType → 직접 토픽 | 모든 이벤트 → default topic |
| markPublished | 개별 save | batch markPublished |
| 메트릭 | (없음) | outboxPublished/Failed |
| 진보도 | 단순 | 정교 |

→ **quant 의 metrics + batch update 패턴이 운영 우위**. 단 partition key 는 inventory 가 정공법.

## 7. Kafka Streams (analytics)

```kotlin
// analytics/.../KafkaStreamsConfig.kt
@EnableKafkaStreams
class KafkaStreamsConfig {
    @Bean(name = ["defaultKafkaStreamsConfig"])
    fun kStreamsConfig(): KafkaStreamsConfiguration {
        return KafkaStreamsConfiguration(mapOf(
            StreamsConfig.APPLICATION_ID_CONFIG to "analytics-streams",
            StreamsConfig.DEFAULT_DESERIALIZATION_EXCEPTION_HANDLER_CLASS_CONFIG
                to LogAndContinueExceptionHandler::class.java.name,
            StreamsConfig.COMMIT_INTERVAL_MS_CONFIG to 1000,
            StreamsConfig.STATE_DIR_CONFIG to "/tmp/kafka-streams/analytics"
        ))
    }
}
```

**관찰**:
- `processing.guarantee` 미설정 → 기본 `at_least_once`. EOS 미사용.
- `LogAndContinueExceptionHandler` — deserialize 실패 시 skip + log. Streams 의 자체 DLQ 역할 (별도 토픽 안 보냄)
- commit.interval.ms=1000 — 1초마다 offset commit (default 30s 보다 짧음)

`AnalyticsStreamTopology.kt`:
```kotlin
events
    .filter { _, event -> event.eventType in [PRODUCT_VIEW, PRODUCT_CLICK, ORDER_COMPLETE] }
    .selectKey { _, event -> event.payload["productId"]?.toString() ?: "unknown" }
    .groupByKey(Grouped.with(Serdes.String(), eventSerde))
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofHours(1)))
    .aggregate({ ProductMetrics() }, ...)
    .toStream()
    .foreach { windowedKey, metrics ->
        scoreCache.cacheProductScore(score)
        productScoreRepository.save(score)
        kafkaTemplate.send(SCORE_OUTPUT_TOPIC, productId.toString(), updateEvent)
    }
```

- 1시간 tumbling window 로 집계
- output: Redis 캐시 + ClickHouse + 새 Kafka 토픽 (analytics.score.updated)
- ⚠️ external write (Redis, ClickHouse) 가 Streams 내부에 → EOS 안 켜도 어차피 외부 IO 멱등 책임. 현재 패턴 합리적.

**개선 후보** (`13-improvements.md`):
- `processing.guarantee=exactly_once_v2` 도입 시 Kafka 출력은 정확히 1회 보장 (외부 write 는 별개)
- 외부 write 는 Score 의 `compute_at` 같은 windowedKey 기반 멱등 설계

## 8. 인프라 구성 검증

### 로컬 (k3d, KRaft single-node)
`k8s/infra/local/kafka/statefulset.yaml`:
- bitnamilegacy/kafka:3.8
- KRaft 모드, controller+broker combined
- `KAFKA_CFG_OFFSETS_TOPIC_REPLICATION_FACTOR=1` (단일 노드)
- `KAFKA_CFG_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1`
- `KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true` (편의)

### 프로덕션 (Strimzi, KRaft dedicated)
`k8s/infra/prod/strimzi/kafka-cluster.yaml`:
- 3 controller (KafkaNodePool), 3 broker (KafkaNodePool)
- `default.replication.factor=3`
- `min.insync.replicas=2`
- `transaction.state.log.min.isr=2`
- `topicOperator: {}` — KafkaTopic CRD 로 토픽 자동 reconcile
- `authorization: simple` — ACL 활성

### 토픽 (kafka-convention.md 와 일치)
`k8s/infra/prod/strimzi/kafka-topics.yaml`:
- 도메인 이벤트: 6 partitions, 3 replicas, retention 7d, min.ISR (In-Sync Replicas) 2
- `analytics.event.collected`: **12 partitions, 30d retention** (트래픽 + 재처리)
- DLT 토픽은 명시 안 됨 → auto-create 또는 운영 시 직접 생성 필요

⚠️ **개선 후보**: DLT 토픽도 KafkaTopic CRD 로 명시적으로 선언 (운영 가시성).

## 9. application.yml 수준 (예: order)

```yaml
# order/app/src/main/resources/application.yml
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}

kafka:
  topics:
    order-completed: order.order.completed
    order-cancelled: order.order.cancelled
```

→ 토픽 이름을 yml 에서 외부화. 환경별 변경 가능.

## 10. 발견 사항 요약

### 잘 된 점
- ✓ Producer 표준 (acks=all + idempotence + max.in.flight=5 + delivery.timeout=120s) 일관
- ✓ DLQ 정책 (FixedBackOff 1s × 3 + .DLT 접미사) 일관
- ✓ ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012 컨슈머 멱등 패턴 적용 (inventory, order, quant)
- ✓ Outbox 패턴 (inventory, fulfillment, quant) — 도메인 변경 atomic
- ✓ 토픽 컨벤션 (`{domain}.{entity}.{event}`) + groupId 컨벤션 (`{service}-{purpose}`) 일관
- ✓ KRaft 모드 (ZK 부담 없음)
- ✓ 프로덕션 RF=3 + min.ISR=2 (안전성 + 가용성 균형)

### 개선 후보
- △ `partition.assignment.strategy=CooperativeStickyAssignor` 미설정
- △ `group.instance.id` 미설정 (K8s rolling restart 시 매번 rebalance)
- △ `compression.type` 기본 none → JSON 페이로드 lz4 권장
- △ inventory 의 멱등 패턴이 비즈니스 트랜잭션과 분리 (atomic 하지 않음)
- △ inventory KafkaConfig 의 DefaultErrorHandler 가 인라인 → quant 패턴 (별도 클래스 + Conditional) 으로 통일
- △ DLT 토픽이 KafkaTopic CRD 미선언 (auto-create 의존)
- △ Outbox key 가 quant 은 eventId (순서 보장 안 됨) → aggregateId 기반 정밀 토픽 매핑 필요
- △ Schema Registry 미사용 — JSON 직렬화 의존, 스키마 변경 시 호환성 직접 관리
- △ analytics Streams 의 `processing.guarantee` 미설정 (기본 at_least_once)
- △ rack-awareness 미설정 (multi-AZ (Availability Zone, 가용 영역) 시 cross-AZ 비용)

자세한 우선순위 + ADR 필요 여부는 [13-improvements.md](13-improvements.md).

## 11. 다음 단계

- [12-interview-qa.md](12-interview-qa.md) — 면접 Q&A 카드
- [13-improvements.md](13-improvements.md) — 개선 우선순위 + ADR 후보
