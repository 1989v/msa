package com.kgd.fulfillment.infrastructure.persistence.fulfillment.repository

import com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity.FulfillmentOrderJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface FulfillmentOrderJpaRepository : JpaRepository<FulfillmentOrderJpaEntity, Long> {
    fun findAllByOrderId(orderId: Long): List<FulfillmentOrderJpaEntity>
    fun findByOrderIdAndWarehouseId(orderId: Long, warehouseId: Long): FulfillmentOrderJpaEntity?
}
