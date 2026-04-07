package com.kgd.fulfillment.infrastructure.persistence.fulfillment.repository

import com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity.FulfillmentOrderJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface FulfillmentOrderJpaRepository : JpaRepository<FulfillmentOrderJpaEntity, Long> {
    fun findByOrderId(orderId: Long): FulfillmentOrderJpaEntity?
}
