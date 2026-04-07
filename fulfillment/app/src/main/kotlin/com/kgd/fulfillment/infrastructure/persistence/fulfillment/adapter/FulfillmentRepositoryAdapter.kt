package com.kgd.fulfillment.infrastructure.persistence.fulfillment.adapter

import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity.FulfillmentOrderJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.fulfillment.repository.FulfillmentOrderJpaRepository
import org.springframework.stereotype.Component

@Component
class FulfillmentRepositoryAdapter(
    private val jpaRepository: FulfillmentOrderJpaRepository
) : FulfillmentRepositoryPort {

    override fun save(fulfillmentOrder: FulfillmentOrder): FulfillmentOrder {
        val entity = FulfillmentOrderJpaEntity.fromDomain(fulfillmentOrder)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): FulfillmentOrder? {
        return jpaRepository.findById(id).orElse(null)?.toDomain()
    }

    override fun findByOrderId(orderId: Long): FulfillmentOrder? {
        return jpaRepository.findByOrderId(orderId)?.toDomain()
    }
}
