package com.kgd.order.presentation.order.dto

import com.kgd.order.application.order.usecase.OrderAccepted
import com.kgd.order.application.order.usecase.OrderDetail
import java.time.Instant
import java.time.LocalDateTime

/** 202 본문 — 접수 직후 상태. 결과는 `GET /api/v1/orders/{id}` 폴링으로 본다 */
data class OrderAcceptedResponse(val orderId: Long, val status: String, val sagaStep: String) {
    companion object {
        fun from(a: OrderAccepted) = OrderAcceptedResponse(a.orderId, a.status, a.sagaStep)
    }
}

/**
 * 주문 상세 — FE 결제 대기 화면이 폴링한다. [status] 가 CONFIRMED·FULFILLING·COMPLETED 면 성공,
 * FAILED 면 [failureReason](BENEFIT_UNAVAILABLE 이면 주문서 재생성 안내), CANCELLED 면 취소. 그 사이는 진행 중이다.
 * 「부분 환불」 표시는 [refundedAmount] > 0 에서 유도한다.
 */
data class OrderResponse(
    val orderId: Long,
    val status: String,
    val failureReason: String?,
    val sagaStep: String?,
    val sagaStatus: String?,
    val itemsAmount: Long,
    val couponDiscount: Long,
    val pointAmount: Long,
    val shippingAmount: Long,
    val payableAmount: Long,
    val refundedAmount: Long,
    val createdAt: LocalDateTime,
    val lines: List<OrderLineResponse>,
    val shippingLines: List<OrderShippingResponse>,
) {
    companion object {
        fun from(d: OrderDetail) = OrderResponse(
            orderId = d.orderId,
            status = d.status,
            failureReason = d.failureReason,
            sagaStep = d.sagaStep,
            sagaStatus = d.sagaStatus,
            itemsAmount = d.itemsAmount,
            couponDiscount = d.couponDiscount,
            pointAmount = d.pointAmount,
            shippingAmount = d.shippingAmount,
            payableAmount = d.payableAmount,
            refundedAmount = d.refundedAmount,
            createdAt = d.createdAt,
            lines = d.lines.map {
                OrderLineResponse(
                    it.orderItemId, it.lineNo, it.productId, it.productName, it.sellerId, it.unitPrice, it.quantity,
                    it.couponDiscount, it.pointAmount, it.payable, it.status, it.shippedAt, it.deliveredAt, it.purchaseConfirmedAt,
                )
            },
            shippingLines = d.shippingLines.map { OrderShippingResponse(it.sellerId, it.fee) },
        )
    }
}

data class OrderLineResponse(
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
    /** ACTIVE · CANCELLED · PURCHASE_CONFIRMED */
    val status: String,
    /** 출고·배송 완료·구매 확정 시각 — 이행 이벤트로 채운다 */
    val shippedAt: Instant?,
    val deliveredAt: Instant?,
    val purchaseConfirmedAt: Instant?,
)

data class OrderShippingResponse(val sellerId: Long, val fee: Long)
