package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.domain.order.model.Order
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * `order.order.confirmed` (키 = orderId) — settlement 의 매입 분개 원천(스펙 SR-9).
 * 라인마다 판매자·안분·수수료·순매출을 싣고, 판매자별 배송비 라인을 따로 싣는다 — settlement 는 다른 스키마를 읽지 않는다.
 * 검산: 결제액 = Σ순매출 + Σ배송비 − Σ플랫폼 쿠폰 − Σ포인트.
 */
@Component
class OrderOutboxEventAdapter(
    @Qualifier("orderOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : OrderEventPort {

    override fun publishConfirmed(order: Order, confirmedAt: Instant) {
        val orderId = requireNotNull(order.id) { "저장되지 않은 주문의 확정 이벤트" }
        val payload = OrderConfirmedPayload(
            orderId = orderId,
            memberId = order.userId,
            itemsAmount = order.itemsAmount,
            couponDiscount = order.couponDiscount,
            pointAmount = order.pointAmount,
            shippingAmount = order.shippingAmount,
            payableAmount = order.payableAmount,
            confirmedAt = confirmedAt,
            lines = order.items.map {
                OrderConfirmedLine(
                    orderItemId = requireNotNull(it.id) { "저장되지 않은 라인: orderId=$orderId, line=${it.lineNo}" },
                    lineNo = it.lineNo,
                    sellerId = it.sellerId,
                    productId = it.productId,
                    quantity = it.quantity,
                    unitPrice = it.unitPrice.amount,
                    sellerCouponAllocation = it.sellerCouponAllocation,
                    platformCouponAllocation = it.platformCouponAllocation,
                    pointAllocation = it.pointAmount,
                    commissionRateBp = it.commissionRateBp,
                    netSales = it.netSales,
                    commission = it.commission,
                    payable = it.payable,
                )
            },
            shippingLines = order.shippingLines.map { OrderConfirmedShipping(it.sellerId, it.fee) },
        )
        outbox.save(
            aggregateType = AGGREGATE_TYPE,
            aggregateId = orderId,
            eventType = CONFIRMED_TOPIC,
            payload = objectMapper.writeValueAsString(payload),
            partitionKey = orderId.toString(),
            headers = emptyMap(),
        )
    }

    companion object {
        const val AGGREGATE_TYPE = "Order"
        const val CONFIRMED_TOPIC = "order.order.confirmed"
    }
}

data class OrderConfirmedPayload(
    val orderId: Long,
    val memberId: String,
    val itemsAmount: Long,
    val couponDiscount: Long,
    val pointAmount: Long,
    val shippingAmount: Long,
    val payableAmount: Long,
    val confirmedAt: Instant,
    val lines: List<OrderConfirmedLine>,
    val shippingLines: List<OrderConfirmedShipping>,
)

data class OrderConfirmedLine(
    val orderItemId: Long,
    val lineNo: Int,
    val sellerId: Long,
    val productId: Long,
    val quantity: Int,
    val unitPrice: Long,
    val sellerCouponAllocation: Long,
    val platformCouponAllocation: Long,
    val pointAllocation: Long,
    val commissionRateBp: Int,
    /** 판매가 × 수량 − 판매자 부담 쿠폰 */
    val netSales: Long,
    /** HALF_UP(순매출 × bp / 10000) */
    val commission: Long,
    /** 라인 결제액 = 판매가 × 수량 − 쿠폰 안분 − 포인트 안분 */
    val payable: Long,
)

/** 판매자별 배송비 — 수수료 없음 */
data class OrderConfirmedShipping(val sellerId: Long, val fee: Long)
