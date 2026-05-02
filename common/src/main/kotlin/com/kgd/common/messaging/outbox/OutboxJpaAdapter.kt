package com.kgd.common.messaging.outbox

/**
 * Default [OutboxPort] implementation backed by JPA.
 *
 * - bean 등록은 [KgdMessagingOutboxAutoConfiguration] 가 담당.
 * - 호출자는 비즈니스 transaction 안에서 본 어댑터를 호출하여 entity save 와 outbox row INSERT 가
 *   같은 commit 에 묶이도록 보장해야 한다.
 */
class OutboxJpaAdapter(
    private val repository: OutboxRepository,
) : OutboxPort {

    override fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String) {
        repository.save(
            OutboxEntity(
                aggregateType = aggregateType,
                aggregateId = aggregateId,
                eventType = eventType,
                payload = payload,
            ),
        )
    }
}
