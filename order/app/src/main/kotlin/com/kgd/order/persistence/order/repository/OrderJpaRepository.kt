package com.kgd.order.infrastructure.persistence.order.repository

import com.kgd.order.infrastructure.persistence.order.entity.OrderJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface OrderJpaRepository : JpaRepository<OrderJpaEntity, Long> {
    @Query("SELECT o FROM OrderJpaEntity o JOIN FETCH o.items WHERE o.id = :id")
    fun findByIdWithItems(id: Long): OrderJpaEntity?
}
