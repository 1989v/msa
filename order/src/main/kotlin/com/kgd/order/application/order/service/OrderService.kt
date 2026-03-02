package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.port.PaymentPort
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class OrderService(
    private val repositoryPort: OrderRepositoryPort,
    private val eventPort: OrderEventPort,
    private val paymentPort: PaymentPort
) : PlaceOrderUseCase, GetOrderUseCase {

    override suspend fun execute(command: PlaceOrderUseCase.Command): PlaceOrderUseCase.Result {
        val items = command.items.map {
            OrderItem.of(it.productId, it.quantity, Money(it.unitPrice))
        }
        val order = Order.create(userId = command.userId, items = items)
        val saved = repositoryPort.save(order)

        // 외부 결제 API 호출 (coroutine IO)
        paymentPort.requestPayment(
            orderId = requireNotNull(saved.id) { "저장된 주문에 ID가 없습니다" },
            amount = saved.totalAmount.amount
        )

        saved.complete()
        val completed = repositoryPort.save(saved)
        eventPort.publishOrderCompleted(completed)

        return PlaceOrderUseCase.Result(
            orderId = requireNotNull(completed.id) { "완료된 주문에 ID가 없습니다" },
            userId = completed.userId,
            totalAmount = completed.totalAmount.amount,
            status = completed.status.name
        )
    }

    @Transactional(readOnly = true)
    override fun execute(id: Long): GetOrderUseCase.Result {
        val order = repositoryPort.findById(id) ?: throw OrderNotFoundException(id)
        return GetOrderUseCase.Result(
            orderId = requireNotNull(order.id) { "주문에 ID가 없습니다" },
            userId = order.userId,
            totalAmount = order.totalAmount.amount,
            status = order.status.name
        )
    }
}
