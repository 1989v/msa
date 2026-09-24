package com.kgd.order.infrastructure.persistence.saga.repository

import com.kgd.order.domain.saga.model.SagaStatus
import com.kgd.order.infrastructure.persistence.saga.entity.OrderSagaJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.Instant

interface OrderSagaJpaRepository : JpaRepository<OrderSagaJpaEntity, Long> {
    @Query(
        "SELECT s.orderId FROM OrderSagaJpaEntity s WHERE s.status IN :statuses AND s.nextDeadlineAt <= :now ORDER BY s.nextDeadlineAt",
    )
    fun findDueOrderIds(statuses: Collection<SagaStatus>, now: Instant, page: Pageable): List<Long>
}
