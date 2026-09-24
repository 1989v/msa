package com.kgd.common.messaging.outbox

import tools.jackson.databind.ObjectMapper

/**
 * Default [OutboxPort] implementation backed by JPA.
 *
 * - bean 등록은 [KgdMessagingOutboxAutoConfiguration] 가 담당.
 * - 호출자는 비즈니스 transaction 안에서 본 어댑터를 호출하여 entity save 와 outbox row INSERT 가
 *   같은 commit 에 묶이도록 보장해야 한다.
 * - [headerSource] 가 주는 문맥 헤더(추적)를 행에 함께 남긴다. 호출자가 같은 이름을 넘기면 호출자 것이 이긴다.
 */
class OutboxJpaAdapter(
    private val repository: OutboxRepository,
    private val objectMapper: ObjectMapper = ObjectMapper(),
    private val headerSource: OutboxHeaderSource = OutboxHeaderSource.NONE,
) : OutboxPort {

    override fun save(
        aggregateType: String,
        aggregateId: Long,
        eventType: String,
        payload: String,
        partitionKey: String?,
        headers: Map<String, String>,
    ) {
        repository.save(
            OutboxEntity(
                aggregateType = aggregateType,
                aggregateId = aggregateId,
                eventType = eventType,
                payload = payload,
                partitionKey = partitionKey,
                headers = (headerSource.headers() + headers).takeIf { it.isNotEmpty() }?.let(objectMapper::writeValueAsString),
            ),
        )
    }
}
