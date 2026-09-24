package com.kgd.common.messaging.outbox

/**
 * Application-layer port that domain services depend on to enqueue events into the outbox.
 *
 * 호출은 비즈니스 entity save 와 **반드시 같은 `@Transactional`** 안에서 이루어져야 한다 (Outbox 의 본질).
 * 실제 Kafka publish 는 [OutboxPollingPublisher] 가 별도 스케줄로 처리한다.
 */
interface OutboxPort {
    fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String) =
        save(aggregateType, aggregateId, eventType, payload, partitionKey = null, headers = emptyMap())

    /**
     * @param partitionKey Kafka 레코드 키. null 이면 [aggregateId] — 같은 키의 이벤트가 한 파티션에 순서대로 놓인다.
     * @param headers 발행 시 Kafka 헤더로 복원된다(`traceparent` 등).
     */
    fun save(
        aggregateType: String,
        aggregateId: Long,
        eventType: String,
        payload: String,
        partitionKey: String?,
        headers: Map<String, String>,
    )
}
