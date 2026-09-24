package com.kgd.fulfillment.infrastructure.persistence.fulfillment.repository

import com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity.FulfillmentLineJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface FulfillmentLineJpaRepository : JpaRepository<FulfillmentLineJpaEntity, Long> {
    fun findAllByFulfillmentIdIn(fulfillmentIds: Collection<Long>): List<FulfillmentLineJpaEntity>
}
