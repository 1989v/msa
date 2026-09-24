package com.kgd.fulfillment.infrastructure.persistence.fulfillment.adapter

import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity.FulfillmentLineJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity.FulfillmentOrderJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.fulfillment.repository.FulfillmentLineJpaRepository
import com.kgd.fulfillment.infrastructure.persistence.fulfillment.repository.FulfillmentOrderJpaRepository
import org.springframework.stereotype.Component

@Component
class FulfillmentRepositoryAdapter(
    private val jpaRepository: FulfillmentOrderJpaRepository,
    private val lineRepository: FulfillmentLineJpaRepository,
) : FulfillmentRepositoryPort {

    override fun save(fulfillmentOrder: FulfillmentOrder): FulfillmentOrder {
        val saved = jpaRepository.save(FulfillmentOrderJpaEntity.fromDomain(fulfillmentOrder))
        val fulfillmentId = requireNotNull(saved.id)
        val lines = lineRepository.saveAll(fulfillmentOrder.getLines().map { FulfillmentLineJpaEntity.fromDomain(fulfillmentId, it) })
        return saved.toDomain(lines.sortedBy { it.id }.map { it.toDomain() })
    }

    override fun findById(id: Long): FulfillmentOrder? =
        jpaRepository.findById(id).orElse(null)?.let { withLines(listOf(it)).single() }

    override fun findAllByOrderId(orderId: Long): List<FulfillmentOrder> =
        withLines(jpaRepository.findAllByOrderId(orderId))

    override fun findByOrderIdAndWarehouseId(orderId: Long, warehouseId: Long): FulfillmentOrder? =
        jpaRepository.findByOrderIdAndWarehouseId(orderId, warehouseId)?.let { withLines(listOf(it)).single() }

    private fun withLines(orders: List<FulfillmentOrderJpaEntity>): List<FulfillmentOrder> {
        if (orders.isEmpty()) return emptyList()
        val lines = lineRepository.findAllByFulfillmentIdIn(orders.mapNotNull { it.id }).groupBy { it.fulfillmentId }
        return orders.map { fo -> fo.toDomain(lines[fo.id].orEmpty().sortedBy { it.id }.map { it.toDomain() }) }
    }
}
