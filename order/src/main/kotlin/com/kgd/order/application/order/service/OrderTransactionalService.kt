package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Handles transactional DB operations for order management.
 * Separated from OrderService to ensure each DB operation
 * has a short-lived transaction that does NOT span external HTTP calls.
 */
@Service
class OrderTransactionalService(
    private val repositoryPort: OrderRepositoryPort
) {

    @Transactional
    fun savePendingOrder(command: PlaceOrderUseCase.Command): Order {
        val items = command.items.map {
            OrderItem.of(it.productId, it.quantity, Money(it.unitPrice))
        }
        val order = Order.create(userId = command.userId, items = items)
        return repositoryPort.save(order)
    }

    @Transactional
    fun completeOrder(orderId: Long): Order {
        val order = repositoryPort.findById(orderId)
            ?: throw OrderNotFoundException(orderId)
        order.complete()
        return repositoryPort.save(order)
    }

    @Transactional
    fun cancelOrder(orderId: Long): Order {
        val order = repositoryPort.findById(orderId)
            ?: throw OrderNotFoundException(orderId)
        order.cancel()
        return repositoryPort.save(order)
    }

    @Transactional(readOnly = true)
    fun findById(id: Long): Order? = repositoryPort.findById(id)
}
