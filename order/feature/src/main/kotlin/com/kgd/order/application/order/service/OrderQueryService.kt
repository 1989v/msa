package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.usecase.GetMyOrdersUseCase
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.OrderDetail
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.application.saga.port.OrderSagaRepositoryPort
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.saga.model.OrderSaga
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 주문 조회 — 상태 · 사가 단계 · 실패 사유. 남의 주문은 없는 주문과 같은 404 */
@Service
class OrderQueryService(
    private val orders: OrderRepositoryPort,
    private val sagas: OrderSagaRepositoryPort,
    private val sellers: SellerViewRepositoryPort,
) : GetOrderUseCase, GetMyOrdersUseCase {

    @Transactional("orderTransactionManager", readOnly = true)
    override fun execute(orderId: Long, requesterId: String, isAdmin: Boolean): OrderDetail {
        val order = orders.findById(orderId)?.takeIf { isAdmin || it.userId == requesterId } ?: throw OrderNotFoundException(orderId)
        return OrderDetail.of(order, sagaOf(orderId, sagas.findByOrderId(orderId)), sellerNames(listOf(order)))
    }

    @Transactional("orderTransactionManager", readOnly = true)
    override fun execute(userId: String): List<OrderDetail> {
        val mine = orders.findAllByUserId(userId)
        val sagaByOrder = sagas.findAllByOrderIds(mine.mapNotNull { it.id }).associateBy { it.orderId }
        val names = sellerNames(mine)
        return mine.map { OrderDetail.of(it, sagaOf(requireNotNull(it.id), sagaByOrder[it.id]), names) }
    }

    private fun sellerNames(orders: List<Order>): Map<Long, String> =
        sellers.findAllByIds(orders.flatMap { o -> o.items.map { it.sellerId } }.toSet())
            .mapNotNull { v -> v.businessName?.let { v.sellerId to it } }.toMap()

    private fun sagaOf(orderId: Long, saga: OrderSaga?): OrderSaga = requireNotNull(saga) { "사가 없는 주문: orderId=$orderId" }
}
