package com.kgd.order.domain.claim.model

import com.kgd.order.domain.claim.exception.ClaimNotAllowedException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.sheet.model.ShippingLine

/**
 * 클레임 환불 계산 (스펙 SR-8). 금액은 주문 라인 스냅샷에서만 온다 — 쿠폰은 다시 계산하지 않는다.
 *
 * - 라인 하나가 돌려받는 값 = 판매가 × 수량 − 쿠폰 안분. 그중 포인트 안분분은 포인트로 원복하고 나머지(라인 결제액)는 PG 환불.
 * - 쿠폰: 부분 취소는 쿠폰 할인을 그대로 둔다(남은 금액이 최소 주문 금액 아래여도). 주문의 모든 라인이 취소되면 쿠폰을 돌려준다.
 * - 배송비: 판매자의 라인이 **전부** 취소되고 그중 출고된 것이 없을 때만 그 판매자 배송비를 환불한다.
 *
 * PG 환불액 = Σ라인 결제액 + 환불 배송비. settlement 의 환불 분개(PG 미수금 n+s−dp−p)와 같은 값이다.
 */
data class ClaimRefundPlan(
    val lines: List<OrderItem>,
    val shippingRefunds: List<ShippingLine>,
    /** 이 클레임 뒤에 주문의 모든 라인이 취소된다 — 쿠폰 반환 조건 */
    val fullCancel: Boolean,
    /** 주문에 쿠폰이 쓰였고 전체 취소다 — 반환 여부는 promotion 이 쿠폰 기간을 보고 정한다 */
    val couponReturn: Boolean,
) {
    val pointRestore: Long get() = lines.sumOf { it.pointAmount }
    val shippingRefund: Long get() = shippingRefunds.sumOf { it.fee }
    val pgRefund: Long get() = lines.sumOf { it.payable } + shippingRefund

    /** 혜택 원복 명령이 할 일이 있는가 — 포인트가 있거나 쿠폰을 돌려준다 */
    val restoresPromotion: Boolean get() = pointRestore > 0 || couponReturn

    companion object {
        /**
         * [shippedSellers] 는 배송비를 환불하지 않을 판매자 — 이번 클레임 상품이 이미 출고됐거나, 앞선 클레임에서 출고 뒤 취소된 라인이 있는 판매자.
         */
        fun of(order: Order, lineNos: Collection<Int>, shippedSellers: Set<Long>): ClaimRefundPlan {
            val requested = lineNos.toSet()
            if (requested.isEmpty()) throw ClaimNotAllowedException("취소할 라인을 고르세요")
            val lines = requested.sorted().map { no ->
                order.items.firstOrNull { it.lineNo == no } ?: throw ClaimNotAllowedException("주문에 없는 라인입니다: $no")
            }
            lines.firstOrNull { it.status != OrderLineStatus.ACTIVE }?.let {
                throw ClaimNotAllowedException("취소할 수 없는 라인입니다: 라인 ${it.lineNo} (${it.status})")
            }
            fun gone(item: OrderItem) = item.lineNo in requested || item.status == OrderLineStatus.CANCELLED
            val shippingRefunds = lines.map { it.sellerId }.distinct()
                .filter { sellerId -> sellerId !in shippedSellers && order.items.filter { it.sellerId == sellerId }.all(::gone) }
                .mapNotNull { sellerId -> order.shippingLines.firstOrNull { it.sellerId == sellerId } }
                .filter { it.fee > 0 }
            val fullCancel = order.items.all(::gone)
            return ClaimRefundPlan(lines, shippingRefunds, fullCancel, couponReturn = fullCancel && order.userCouponId != null)
        }
    }
}
