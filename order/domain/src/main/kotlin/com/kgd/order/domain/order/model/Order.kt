package com.kgd.order.domain.order.model

import com.kgd.order.domain.order.exception.InvalidOrderStatusException
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.ShippingLine
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * 주문. 금액은 주문서 스냅샷(라인·판매자별 배송비)에서만 오고, 상태는 [OrderStatus] 표의 전이만 한다.
 * 전이마다 [StatusChange] 를 쌓고, 저장소가 [pullStatusChanges] 로 꺼내 이력 행으로 남긴다 —
 * 상태를 바꾸는 길이 이 클래스의 메서드뿐이라 이력 없는 전이가 생기지 않는다.
 */
class Order private constructor(
    val id: Long?,
    val userId: String,
    val orderSheetId: Long?,
    val userCouponId: Long?,
    val items: List<OrderItem>,
    val shippingLines: List<ShippingLine>,
    status: OrderStatus,
    failureReason: OrderFailureReason?,
    refundedAmount: Long,
    val createdAt: LocalDateTime,
    val version: Long,
) {
    var status: OrderStatus = status
        private set
    var failureReason: OrderFailureReason? = failureReason
        private set
    var refundedAmount: Long = refundedAmount
        private set

    private val changes = mutableListOf<StatusChange>()

    val itemsAmount: Long get() = items.sumOf { it.amount }
    val couponDiscount: Long get() = items.sumOf { it.couponDiscount }
    val pointAmount: Long get() = items.sumOf { it.pointAmount }
    val shippingAmount: Long get() = shippingLines.sumOf { it.fee }

    /** 결제액 = 상품 − 쿠폰 − 포인트 + 배송비. 0 이면 결제 단계를 건너뛴다 */
    val payableAmount: Long get() = itemsAmount - couponDiscount - pointAmount + shippingAmount

    /** 재고·혜택 예약 완료 → 결제 승인 명령 */
    fun awaitPayment(now: Instant) = move(OrderStatus.PAYMENT_PENDING, null, StatusChange.SYSTEM, now)

    /** 결제 AUTHORIZED */
    fun markPaid(now: Instant) = move(OrderStatus.PAID, null, StatusChange.SYSTEM, now)

    /** 재고·혜택 확정 + 매입 완료. 결제 없이(CREATED 에서) 오는 것은 0원 주문뿐이다 */
    fun confirm(now: Instant) {
        if (status == OrderStatus.CREATED && payableAmount != 0L) {
            throw InvalidOrderStatusException("결제액이 있는 주문은 결제 없이 확정할 수 없다: orderId=$id")
        }
        move(OrderStatus.CONFIRMED, null, StatusChange.SYSTEM, now)
    }

    /** 피벗 전 실패(보상 완료) · 매입 전 보류 만료(VOID 후) */
    fun fail(reason: OrderFailureReason, now: Instant) {
        move(OrderStatus.FAILED, reason.name, StatusChange.SYSTEM, now)
        failureReason = reason
    }

    /** 구매자 취소 — 피벗 전(CREATED)만, 보상이 끝난 뒤 */
    fun cancelBeforePayment(actor: String, now: Instant) {
        if (status != OrderStatus.CREATED) throw InvalidOrderStatusException("$status → ${OrderStatus.CANCELLED}(구매자 취소)")
        move(OrderStatus.CANCELLED, OrderFailureReason.BUYER_CANCELLED.name, actor, now)
    }

    fun startFulfilling(now: Instant) = move(OrderStatus.FULFILLING, null, StatusChange.SYSTEM, now)

    /** 취소되지 않은 라인이 전부 구매 확정됐을 때 */
    fun completePurchase(now: Instant) {
        val remaining = items.filter { it.status != OrderLineStatus.CANCELLED }
        if (remaining.isEmpty() || remaining.any { it.status != OrderLineStatus.PURCHASE_CONFIRMED }) {
            throw InvalidOrderStatusException("구매 확정되지 않은 라인이 남았다: orderId=$id")
        }
        move(OrderStatus.COMPLETED, null, StatusChange.SYSTEM, now)
    }

    /** 전체 취소 클레임 환불 완료 — 모든 라인이 CANCELLED 일 때 */
    fun cancelByClaim(actor: String, now: Instant) {
        if (items.any { it.status != OrderLineStatus.CANCELLED }) {
            throw InvalidOrderStatusException("취소되지 않은 라인이 남았다: orderId=$id")
        }
        move(OrderStatus.CANCELLED, "CLAIM", actor, now)
    }

    /** 라인 취소 — 확정 뒤(클레임)만 */
    fun cancelLine(lineNo: Int) {
        requireStatus(OrderStatus.CONFIRMED, OrderStatus.FULFILLING)
        line(lineNo).cancel()
    }

    /** 라인 구매 확정 — 이행 중인 주문만 */
    fun confirmLinePurchase(lineNo: Int) {
        requireStatus(OrderStatus.FULFILLING)
        line(lineNo).confirmPurchase()
    }

    /** 환불 누계. 결제액을 넘지 못한다. 화면의 「부분 환불」은 이 값 > 0 에서 유도한다 */
    fun addRefund(amount: Long) {
        require(amount > 0) { "환불액은 양수여야 한다" }
        require(refundedAmount + amount <= payableAmount) {
            "환불 누계가 결제액을 넘는다: orderId=$id, refunded=$refundedAmount, amount=$amount, payable=$payableAmount"
        }
        refundedAmount += amount
    }

    /** 쌓인 전이 이력을 꺼내고 비운다 — 저장소가 저장할 때 부른다 */
    fun pullStatusChanges(): List<StatusChange> = changes.toList().also { changes.clear() }

    private fun line(lineNo: Int): OrderItem =
        items.firstOrNull { it.lineNo == lineNo } ?: throw IllegalArgumentException("라인이 없다: orderId=$id, lineNo=$lineNo")

    private fun requireStatus(vararg allowed: OrderStatus) {
        if (status !in allowed) throw InvalidOrderStatusException("라인 변경은 ${allowed.toList()} 에서만: 지금 $status")
    }

    private fun move(next: OrderStatus, reason: String?, actor: String, now: Instant) {
        if (!status.canMoveTo(next)) throw InvalidOrderStatusException("$status → $next")
        changes += StatusChange(status, next, reason, actor, now)
        status = next
    }

    companion object {
        /** 주문 접수 — 주문서 스냅샷을 옮겨 CREATED 로 만든다. 주문서 사용 표시는 호출자가 id 를 받은 뒤 한다 */
        fun place(userId: String, sheet: OrderSheet, now: Instant, zone: ZoneId): Order {
            require(userId.isNotBlank()) { "사용자 ID가 비어있을 수 없습니다" }
            val order = Order(
                id = null,
                userId = userId,
                orderSheetId = requireNotNull(sheet.id) { "저장되지 않은 주문서" },
                userCouponId = sheet.userCouponId,
                items = sheet.lines.map(OrderItem::fromSheet),
                shippingLines = sheet.shippingLines,
                status = OrderStatus.CREATED,
                failureReason = null,
                refundedAmount = 0L,
                createdAt = LocalDateTime.ofInstant(now, zone),
                version = 0L,
            )
            order.changes += StatusChange(null, OrderStatus.CREATED, null, userId, now)
            return order
        }

        fun restore(
            id: Long?,
            userId: String,
            orderSheetId: Long?,
            userCouponId: Long?,
            items: List<OrderItem>,
            shippingLines: List<ShippingLine>,
            status: OrderStatus,
            failureReason: OrderFailureReason?,
            refundedAmount: Long,
            createdAt: LocalDateTime,
            version: Long,
        ): Order = Order(
            id, userId, orderSheetId, userCouponId, items, shippingLines, status, failureReason, refundedAmount,
            createdAt, version,
        )
    }
}
