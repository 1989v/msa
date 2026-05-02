package com.kgd.common.messaging.outbox

/**
 * Application-layer port that domain services depend on to enqueue events into the outbox.
 *
 * 호출은 비즈니스 entity save 와 **반드시 같은 `@Transactional`** 안에서 이루어져야 한다 (Outbox 의 본질).
 * 실제 Kafka publish 는 [OutboxPollingPublisher] 가 별도 스케줄로 비동기 처리한다.
 *
 * ADR-0028 (Distributed Tracing) 의 `traceparent` 전파를 위한 `headers` 파라미터 확장은
 * 별도 PR 에서 default value 로 추가 예정 (현 시그니처는 inventory/fulfillment 의 기존 사용처와 호환).
 */
interface OutboxPort {
    fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String)
}
