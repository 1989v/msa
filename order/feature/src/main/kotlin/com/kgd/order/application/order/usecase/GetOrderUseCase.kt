package com.kgd.order.application.order.usecase

import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.saga.model.OrderSaga
import java.time.LocalDateTime

/** 주문 단건 — 본인 것만(남의 것은 없는 주문과 같은 404), 어드민은 전부. FE 가 결제 대기 화면에서 폴링한다 */
interface GetOrderUseCase {
    fun execute(orderId: Long, requesterId: String, isAdmin: Boolean): OrderDetail
}

/** 내 주문 목록 — 최신순 */
interface GetMyOrdersUseCase {
    fun execute(userId: String): List<OrderDetail>
}

data class OrderDetail(
    val orderId: Long,
    val userId: String,
    val status: String,
    /** FAILED 사유(또는 구매자 취소 BUYER_CANCELLED 는 사가 쪽). 성공 경로는 null */
    val failureReason: String?,
    /** 사가 단계·상태 — 옛 흐름 주문은 사가가 없어 null */
    val sagaStep: String?,
    val sagaStatus: String?,
    val itemsAmount: Long,
    val couponDiscount: Long,
    val pointAmount: Long,
    val shippingAmount: Long,
    val payableAmount: Long,
    val refundedAmount: Long,
    val createdAt: LocalDateTime,
    val lines: List<Line>,
    val shippingLines: List<Shipping>,
) {
    data class Line(
        val orderItemId: Long?,
        val lineNo: Int,
        val productId: Long,
        val productName: String,
        val sellerId: Long,
        val unitPrice: Long,
        val quantity: Int,
        val couponDiscount: Long,
        val pointAmount: Long,
        val payable: Long,
        val status: String,
    )

    data class Shipping(val sellerId: Long, val fee: Long)

    companion object {
        fun of(order: Order, saga: OrderSaga?) = OrderDetail(
            orderId = requireNotNull(order.id),
            userId = order.userId,
            status = order.status.name,
            failureReason = order.failureReason?.name,
            sagaStep = saga?.step?.name,
            sagaStatus = saga?.status?.name,
            itemsAmount = order.itemsAmount,
            couponDiscount = order.couponDiscount,
            pointAmount = order.pointAmount,
            shippingAmount = order.shippingAmount,
            payableAmount = order.payableAmount,
            refundedAmount = order.refundedAmount,
            createdAt = order.createdAt,
            lines = order.items.map {
                Line(
                    it.id, it.lineNo, it.productId, it.productName, it.sellerId, it.unitPrice.amount, it.quantity,
                    it.couponDiscount, it.pointAmount, it.payable, it.status.name,
                )
            },
            shippingLines = order.shippingLines.map { Shipping(it.sellerId, it.fee) },
        )
    }
}
