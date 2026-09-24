package com.kgd.settlement.domain.ledger.model

import com.kgd.settlement.domain.ledger.exception.InvalidJournalException
import java.time.Instant
import java.time.LocalDate

/**
 * 주문 라인 한 줄의 정산 금액 — order 이벤트가 싣는 값 그대로.
 * [netSales] = 판매가 × 수량 − 판매자 부담 쿠폰, [commission] = HALF_UP(순매출 × bp / 10000).
 */
data class LineAmounts(
    val orderItemId: Long,
    val sellerId: Long,
    val netSales: Long,
    val commission: Long,
    val platformCoupon: Long,
    val point: Long,
) {
    init {
        if (netSales < 0 || commission < 0 || platformCoupon < 0 || point < 0) {
            throw InvalidJournalException("라인 금액은 음수일 수 없습니다: orderItemId=$orderItemId")
        }
        if (commission > netSales) throw InvalidJournalException("수수료가 순매출보다 큽니다: orderItemId=$orderItemId")
    }
}

/** 판매자별 배송비 — 수수료 없음 */
data class ShippingAmount(val sellerId: Long, val fee: Long) {
    init {
        if (fee < 0) throw InvalidJournalException("배송비는 음수일 수 없습니다: sellerId=$sellerId")
    }
}

/**
 * 스펙 SR-9 분개 규칙. 기호: N = Σ순매출 · S = 배송비 · C = Σ수수료 · Dp = 플랫폼 부담 쿠폰 · P = 포인트 · X = N + S − Dp − P.
 *
 * | 시점 | 차변 | 대변 |
 * |---|---|---|
 * | 매입 | PG 미수금 X · 판촉 비용 Dp+P | 판매자 미지급금 N+S−C (판매자별) · 수수료 수익 C |
 * | 환불 | 판매자 미지급금 n+s−c (판매자별) · 수수료 수익 c | PG 미수금 n+s−dp−p · 판촉 비용 dp+p |
 * | PG 입금 | 현금 입금액 · PG 수수료 비용 | PG 미수금 입금액+수수료 |
 * | 지급 | 판매자 미지급금 지급액 | 현금 지급액 |
 *
 * 0원 줄은 만들지 않는다. 원천 키는 원천의 자연 키 — 같은 주문·클레임·대사·정산서는 한 번만 기록된다.
 */
object JournalRules {

    /** 매입. [payableAmount] 는 order 가 실은 결제액 — 라인에서 다시 계산한 X 와 다르면 계약 위반이다 */
    fun capture(
        orderId: Long,
        payableAmount: Long,
        lines: List<LineAmounts>,
        shipping: List<ShippingAmount>,
        sourceEventId: String?,
        at: Instant,
    ): Journal {
        val t = Totals.of(lines, shipping)
        if (t.pgAmount != payableAmount) {
            throw InvalidJournalException("결제액 검산 불일치: order=$orderId, 이벤트 $payableAmount ≠ N+S−Dp−P ${t.pgAmount}")
        }
        val entries = listOfNotNull(
            entry(EntrySide.DEBIT, Account.PG_RECEIVABLE, t.pgAmount),
            entry(EntrySide.DEBIT, Account.PROMOTION_EXPENSE, t.promotion),
        ) + sellerPayables(lines, shipping, EntrySide.CREDIT) +
            listOfNotNull(entry(EntrySide.CREDIT, Account.COMMISSION_REVENUE, t.commission))
        return Journal.record(JournalType.CAPTURE, captureKey(orderId), sourceEventId, orderId, at, entries)
    }

    /** 환불. [refundAmount] 는 PG 환불액 = Σ(n − dp − p) + Σs */
    fun refund(
        claimId: Long,
        orderId: Long,
        refundAmount: Long,
        lines: List<LineAmounts>,
        shipping: List<ShippingAmount>,
        sourceEventId: String?,
        at: Instant,
    ): Journal {
        val t = Totals.of(lines, shipping)
        if (t.pgAmount != refundAmount) {
            throw InvalidJournalException("환불액 검산 불일치: claim=$claimId, 이벤트 $refundAmount ≠ n+s−dp−p ${t.pgAmount}")
        }
        val entries = sellerPayables(lines, shipping, EntrySide.DEBIT) +
            listOfNotNull(
                entry(EntrySide.DEBIT, Account.COMMISSION_REVENUE, t.commission),
                entry(EntrySide.CREDIT, Account.PG_RECEIVABLE, t.pgAmount),
                entry(EntrySide.CREDIT, Account.PROMOTION_EXPENSE, t.promotion),
            )
        return Journal.record(JournalType.REFUND, refundKey(claimId), sourceEventId, orderId, at, entries)
    }

    /** PG 입금 — PG 가 수수료를 떼고 보낸 돈. 미수금은 입금액 + 수수료만큼 줄어든다 */
    fun pgDeposit(
        orderId: Long,
        orderNo: String,
        settleDate: LocalDate,
        depositAmount: Long,
        pgFee: Long,
        sourceEventId: String?,
        at: Instant,
    ): Journal {
        if (depositAmount < 0 || pgFee < 0) throw InvalidJournalException("입금액·PG 수수료는 음수일 수 없습니다: $orderNo")
        val entries = listOfNotNull(
            entry(EntrySide.DEBIT, Account.CASH, depositAmount),
            entry(EntrySide.DEBIT, Account.PG_FEE_EXPENSE, pgFee),
            entry(EntrySide.CREDIT, Account.PG_RECEIVABLE, depositAmount + pgFee),
        )
        return Journal.record(JournalType.PG_DEPOSIT, pgDepositKey(settleDate, orderNo), sourceEventId, orderId, at, entries)
    }

    /** 판매자 지급 — 정산서 지급액만큼 미지급금이 줄고 현금이 나간다 */
    fun payout(statementId: Long, sellerId: Long, amount: Long, at: Instant): Journal {
        if (amount <= 0) throw InvalidJournalException("지급액이 0 이하인 정산서는 지급하지 않는다: statement=$statementId")
        val entries = listOf(
            JournalEntry.debit(Account.SELLER_PAYABLE, amount, sellerId),
            JournalEntry.credit(Account.CASH, amount),
        )
        return Journal.record(JournalType.PAYOUT, payoutKey(statementId), null, null, at, entries)
    }

    fun captureKey(orderId: Long) = "capture:order:$orderId"
    fun refundKey(claimId: Long) = "refund:claim:$claimId"
    fun pgDepositKey(settleDate: LocalDate, orderNo: String) = "pg-deposit:$settleDate:$orderNo"
    fun payoutKey(statementId: Long) = "payout:statement:$statementId"

    /** 판매자별 N_s + S_s − C_s (판매자 id 순서로 — 같은 입력이면 같은 줄 순서) */
    private fun sellerPayables(lines: List<LineAmounts>, shipping: List<ShippingAmount>, side: EntrySide): List<JournalEntry> {
        val bySeller = sortedMapOf<Long, Long>()
        lines.forEach { bySeller.merge(it.sellerId, it.netSales - it.commission, Long::plus) }
        shipping.forEach { bySeller.merge(it.sellerId, it.fee, Long::plus) }
        return bySeller.mapNotNull { (sellerId, amount) -> entry(side, Account.SELLER_PAYABLE, amount, sellerId) }
    }

    private fun entry(side: EntrySide, account: Account, amount: Long, sellerId: Long? = null): JournalEntry? =
        if (amount == 0L) null else JournalEntry(account, side, amount, sellerId)

    private data class Totals(val netSales: Long, val shipping: Long, val commission: Long, val promotion: Long) {
        /** PG 가 움직인 금액 — 매입이면 X = N + S − Dp − P, 환불이면 n + s − dp − p */
        val pgAmount: Long get() = netSales + shipping - promotion

        companion object {
            fun of(lines: List<LineAmounts>, shipping: List<ShippingAmount>) = Totals(
                netSales = lines.sumOf { it.netSales },
                shipping = shipping.sumOf { it.fee },
                commission = lines.sumOf { it.commission },
                promotion = lines.sumOf { it.platformCoupon + it.point },
            )
        }
    }
}
