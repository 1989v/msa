package com.kgd.inventory.infrastructure.persistence.outbox.repository

import com.kgd.inventory.infrastructure.persistence.outbox.entity.OutboxJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface OutboxJpaRepository : JpaRepository<OutboxJpaEntity, Long> {
    fun findAllByStatusOrderByCreatedAtAsc(status: String): List<OutboxJpaEntity>
}
