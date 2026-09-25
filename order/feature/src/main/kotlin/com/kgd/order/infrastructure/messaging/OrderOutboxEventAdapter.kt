package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.PurchaseConfirmTrigger
import com.kgd.order.domain.claim.model.Claim
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.PurchaseConfirmation
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
            lines = order.items.map { line(orderId, it) },
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

    override fun publishClaimRefunded(order: Order, claim: Claim, refundedAt: Instant) {
        val orderId = requireNotNull(order.id)
        val claimId = requireNotNull(claim.id)
        val payload = ClaimRefundedPayload(
            claimId = claimId,
            orderId = orderId,
            memberId = order.userId,
            sellerId = claim.sellerId,
            fullCancel = claim.fullCancel == true,
            goodsShipped = claim.goodsShipped,
            refundAmount = requireNotNull(claim.pgRefund),
            pointRestored = requireNotNull(claim.pointRestore),
            couponReturnRequested = claim.fullCancel == true && order.userCouponId != null,
            refundedAt = refundedAt,
            lines = order.items.filter { it.lineNo in claim.lineNos }.map { line(orderId, it) },
            shippingLines = listOfNotNull(
                claim.shippingRefund?.takeIf { it > 0 }?.let { OrderConfirmedShipping(claim.sellerId, it) },
            ),
        )
        save(claimId, CLAIM_REFUNDED_TOPIC, CLAIM_AGGREGATE_TYPE, orderId, payload)
    }

    override fun publishPurchaseConfirmed(
        order: Order,
        confirmations: List<PurchaseConfirmation>,
        trigger: PurchaseConfirmTrigger,
        confirmedAt: Instant,
    ) {
        val orderId = requireNotNull(order.id)
        confirmations.forEach { c ->
            val payload = LinePurchaseConfirmedPayload(
                orderId = orderId, memberId = order.userId, sellerId = c.line.sellerId, trigger = trigger.name,
                confirmedAt = confirmedAt, line = line(orderId, c.line),
                shippingLine = c.shipping?.let { OrderConfirmedShipping(it.sellerId, it.fee) },
            )
            save(requireNotNull(c.line.id), LINE_PURCHASE_CONFIRMED_TOPIC, LINE_AGGREGATE_TYPE, orderId, payload)
        }
    }

    private fun line(orderId: Long, it: OrderItem) = OrderConfirmedLine(
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

    /** 키는 전부 orderId — 한 주문의 확정·환불·구매 확정이 한 파티션에서 순서대로 settlement 에 닿는다 */
    private fun save(aggregateId: Long, topic: String, aggregateType: String, orderId: Long, payload: Any) {
        outbox.save(
            aggregateType = aggregateType,
            aggregateId = aggregateId,
            eventType = topic,
            payload = objectMapper.writeValueAsString(payload),
            partitionKey = orderId.toString(),
            headers = emptyMap(),
        )
    }

    companion object {
        const val AGGREGATE_TYPE = "Order"
        const val CLAIM_AGGREGATE_TYPE = "OrderClaim"
        const val LINE_AGGREGATE_TYPE = "OrderItem"
        const val CONFIRMED_TOPIC = "order.order.confirmed"
        const val CLAIM_REFUNDED_TOPIC = "order.claim.refunded"
        const val LINE_PURCHASE_CONFIRMED_TOPIC = "order.line.purchase-confirmed"
    }
}

/**
 * `order.claim.refunded` — settlement 환불 분개(차: 판매자 미지급금 n+s−c · 수수료 수익 c / 대: PG 미수금 n+s−dp−p · 판촉 비용 dp+p).
 * 검산: [refundAmount] = Σ라인 payable + Σ배송비 라인 fee = Σ(netSales − platformCouponAllocation − pointAllocation) + s.
 */
data class ClaimRefundedPayload(
    val claimId: Long,
    val orderId: Long,
    val memberId: String,
    val sellerId: Long,
    val fullCancel: Boolean,
    /** 출고 뒤 판매자 승인으로 환불 — 재입고하지 않았고 배송비를 돌려주지 않았다 */
    val goodsShipped: Boolean,
    /** PG 환불액 (0 이면 PG 환불 없음 — 포인트로만 결제한 라인) */
    val refundAmount: Long,
    /** 포인트로 원복한 금액 = Σ라인 pointAllocation */
    val pointRestored: Long,
    /** 전체 취소라 쿠폰 반환을 요청했다(실제 반환은 promotion 이 쿠폰 기간을 보고 정한다) */
    val couponReturnRequested: Boolean,
    val refundedAt: Instant,
    val lines: List<OrderConfirmedLine>,
    /** 환불한 배송비 — 판매자의 라인이 전부 출고 전 취소됐을 때만 있다 */
    val shippingLines: List<OrderConfirmedShipping>,
)

/**
 * `order.line.purchase-confirmed` — 정산 대상. 확정 라인마다 한 건이고, 그 판매자의 첫 확정 라인이면 [shippingLine] 이 실린다.
 */
data class LinePurchaseConfirmedPayload(
    val orderId: Long,
    val memberId: String,
    val sellerId: Long,
    /** BUYER · AUTO */
    val trigger: String,
    val confirmedAt: Instant,
    val line: OrderConfirmedLine,
    val shippingLine: OrderConfirmedShipping?,
)

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
