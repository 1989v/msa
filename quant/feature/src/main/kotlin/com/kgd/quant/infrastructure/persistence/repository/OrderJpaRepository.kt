package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.OrderEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface OrderJpaRepository : JpaRepository<OrderEntity, UUID> {
    fun findByOrderIdAndTenantId(orderId: UUID, tenantId: String): OrderEntity?
    fun findAllBySlotIdAndTenantIdOrderByCreatedAtDesc(
        slotId: UUID,
        tenantId: String
    ): List<OrderEntity>
}
