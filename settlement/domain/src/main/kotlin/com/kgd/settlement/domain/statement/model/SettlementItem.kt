package com.kgd.settlement.domain.statement.model

import com.kgd.settlement.domain.statement.exception.InvalidSettlementItemException
import java.time.Instant

enum class SettlementItemKind { LINE, SHIPPING }

/**
 * 정산 대상 한 건 — 구매 확정 라인(LINE) 또는 그 판매자의 배송비(SHIPPING). `order.line.purchase-confirmed` 로만 생긴다.
 * [key] 는 원천의 자연 키: 라인 = `line:{orderItemId}`, 배송비 = `shipping:{orderId}:{sellerId}` — 환불 기록도 같은 키를 쓴다.
 */
data class SettlementItem(
    val key: String,
    val kind: SettlementItemKind,
    val orderId: Long,
    val orderItemId: Long?,
    val sellerId: Long,
    val netSales: Long,
    val commission: Long,
    val shippingFee: Long,
    val confirmedAt: Instant,
) {
    init {
        if (netSales < 0 || commission < 0 || shippingFee < 0) throw InvalidSettlementItemException("정산 금액은 음수일 수 없습니다: $key")
        when (kind) {
            SettlementItemKind.LINE ->
                if (orderItemId == null || shippingFee != 0L) throw InvalidSettlementItemException("라인 항목은 라인 id 만, 배송비 없이: $key")
            SettlementItemKind.SHIPPING ->
                if (netSales != 0L || commission != 0L) throw InvalidSettlementItemException("배송비 항목은 매출·수수료가 없다: $key")
        }
    }

    /** 이 항목이 지급액에 더하는 몫 = 순매출 + 배송비 − 수수료 */
    val payout: Long get() = netSales + shippingFee - commission

    companion object {
        fun lineKey(orderItemId: Long) = "line:$orderItemId"
        fun shippingKey(orderId: Long, sellerId: Long) = "shipping:$orderId:$sellerId"

        fun line(orderId: Long, orderItemId: Long, sellerId: Long, netSales: Long, commission: Long, confirmedAt: Instant) =
            SettlementItem(lineKey(orderItemId), SettlementItemKind.LINE, orderId, orderItemId, sellerId, netSales, commission, 0L, confirmedAt)

        fun shipping(orderId: Long, sellerId: Long, fee: Long, confirmedAt: Instant) =
            SettlementItem(shippingKey(orderId, sellerId), SettlementItemKind.SHIPPING, orderId, null, sellerId, 0L, 0L, fee, confirmedAt)
    }
}
