package com.kgd.inventory.infrastructure.persistence.outbox.adapter

import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.infrastructure.persistence.outbox.entity.OutboxJpaEntity
import com.kgd.inventory.infrastructure.persistence.outbox.repository.OutboxJpaRepository
import org.springframework.stereotype.Component

@Component
class OutboxAdapter(
    private val jpaRepository: OutboxJpaRepository,
) : OutboxPort {

    override fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String) {
        jpaRepository.save(
            OutboxJpaEntity(
                aggregateType = aggregateType,
                aggregateId = aggregateId,
                eventType = eventType,
                payload = payload,
            )
        )
    }
}
