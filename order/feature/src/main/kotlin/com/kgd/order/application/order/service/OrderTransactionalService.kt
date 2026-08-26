package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderEventPort
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
 *
 * ADR-0032 PR-2: complete/cancel 의 outbox INSERT 가 entity save 와 같은 `@Transactional` 안에서
 * 발생하도록 publish 호출을 본 서비스로 이동했다. 외부 IO 가 아닌 DB INSERT 만 하므로 ADR-0020 호환.
 */
@Service
class OrderTransactionalService(
    private val repositoryPort: OrderRepositoryPort,
    private val eventPort: OrderEventPort,
) {

    @Transactional("orderTransactionManager")
    fun savePendingOrder(command: PlaceOrderUseCase.Command): Order {
        val items = command.items.map {
            OrderItem.of(it.productId, it.quantity, Money(it.unitPrice))
        }
        val order = Order.create(userId = command.userId, items = items)
        return repositoryPort.save(order)
    }

    @Transactional("orderTransactionManager")
    fun completeOrder(orderId: Long): Order {
        val order = repositoryPort.findById(orderId)
            ?: throw OrderNotFoundException(orderId)
        order.complete()
        val saved = repositoryPort.save(order)
        eventPort.publishOrderCompleted(saved)
        return saved
    }

    @Transactional("orderTransactionManager")
    fun cancelOrder(orderId: Long): Order {
        val order = repositoryPort.findById(orderId)
            ?: throw OrderNotFoundException(orderId)
        order.cancel()
        val saved = repositoryPort.save(order)
        eventPort.publishOrderCancelled(saved)
        return saved
    }

    @Transactional("orderTransactionManager", readOnly = true)
    fun findById(id: Long): Order? = repositoryPort.findById(id)

    @Transactional("orderTransactionManager", readOnly = true)
    fun findAllByUserId(userId: String): List<Order> = repositoryPort.findAllByUserId(userId)
}
