package com.kgd.order.infrastructure.persistence.order.adapter

import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.infrastructure.persistence.order.entity.OrderJpaEntity
import com.kgd.order.infrastructure.persistence.order.repository.OrderJpaRepository
import org.springframework.stereotype.Component

@Component
class OrderRepositoryAdapter(
    private val jpaRepository: OrderJpaRepository
) : OrderRepositoryPort {

    override fun save(order: Order): Order {
        val id = order.id
        val entity = if (id != null) {
            jpaRepository.findByIdWithItems(id)
                ?.also { it.status = order.status }
                ?: throw OrderNotFoundException(id)
        } else {
            OrderJpaEntity.fromDomain(order)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Order? =
        jpaRepository.findByIdWithItems(id)?.toDomain()
}
