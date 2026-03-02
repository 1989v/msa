package com.kgd.order.application.order.port

import com.kgd.order.domain.order.model.Order

interface OrderRepositoryPort {
    fun save(order: Order): Order
    fun findById(id: Long): Order?
}
