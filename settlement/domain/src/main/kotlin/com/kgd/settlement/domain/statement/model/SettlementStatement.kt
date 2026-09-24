package com.kgd.settlement.domain.statement.model

import com.kgd.settlement.domain.statement.exception.InvalidStatementStateException
import java.time.Instant
import java.time.Period

/** 정산서 상태 — DRAFT → CONFIRMED → PAID · CONFIRMED → CARRIED_OVER(지급액 ≤ 0, 항목은 다음 기간으로) */
enum class StatementStatus { DRAFT, CONFIRMED, PAID, CARRIED_OVER }

/**
 * 판매자 한 명 · 기간 하나의 정산서. **지급액 = Σ라인 순매출 + Σ배송비 − Σ수수료** 이고, 들어간 항목은 [lines] 로 남긴다(감사용).
 *
 * 들어가는 것은 구매 확정 라인과 그 판매자의 배송비뿐이다. 환불된 라인·배송비는 넣지 않는다 — 환불은 확정 전 라인에서만
 * 일어나 원래 여기 올 일이 없지만, 두 이벤트가 다른 토픽이라 도착 순서가 어긋나도 이중 차감이 생기지 않게 여기서 한 번 더 거른다.
 */
class SettlementStatement private constructor(
    val id: Long?,
    val sellerId: Long,
    val period: SettlementPeriod,
    status: StatementStatus,
    val lines: List<SettlementItem>,
    val createdAt: Instant,
    confirmedAt: Instant?,
    paidAt: Instant?,
    carriedOverAt: Instant?,
    payoutReference: String?,
) {
    var status: StatementStatus = status
        private set
    var confirmedAt: Instant? = confirmedAt
        private set
    var paidAt: Instant? = paidAt
        private set
    var carriedOverAt: Instant? = carriedOverAt
        private set

    /** 모의 송금 참조 — 지급 기록 */
    var payoutReference: String? = payoutReference
        private set

    val netSales: Long get() = lines.sumOf { it.netSales }
    val shippingFee: Long get() = lines.sumOf { it.shippingFee }
    val commission: Long get() = lines.sumOf { it.commission }
    val payout: Long get() = netSales + shippingFee - commission

    fun confirm(now: Instant) {
        if (status != StatementStatus.DRAFT) throw InvalidStatementStateException(status, StatementStatus.CONFIRMED.name)
        status = StatementStatus.CONFIRMED
        confirmedAt = now
    }

    fun pay(reference: String, now: Instant) {
        if (status != StatementStatus.CONFIRMED) throw InvalidStatementStateException(status, StatementStatus.PAID.name)
        if (payout <= 0) throw InvalidStatementStateException(status, "PAID(지급액 ${payout}원 — 이월 대상)")
        status = StatementStatus.PAID
        paidAt = now
        payoutReference = reference
    }

    fun carryOver(now: Instant) {
        if (status != StatementStatus.CONFIRMED) throw InvalidStatementStateException(status, StatementStatus.CARRIED_OVER.name)
        if (payout > 0) throw InvalidStatementStateException(status, "CARRIED_OVER(지급액 ${payout}원 — 지급 대상)")
        status = StatementStatus.CARRIED_OVER
        carriedOverAt = now
    }

    fun withId(id: Long) = SettlementStatement(id, sellerId, period, status, lines, createdAt, confirmedAt, paidAt, carriedOverAt, payoutReference)

    companion object {
        /**
         * 정산 기록 보존기간 — 전자상거래법(계약·대금결제 기록 5년). 개인정보처리방침 6항 「정산 기록」과 같은 숫자여야 한다
         * (portal-fe `privacyRetention.test.ts` 가 두 파일을 읽어 대조한다). 정산서·원장은 이 기간 안에 지우지 않는다.
         */
        val RECORD_RETENTION: Period = Period.ofYears(5)

        /**
         * 초안. [candidates] 중 이 판매자 것이고, 기간 끝 전에 확정됐고, [refundedKeys] 에 없는 것만 담는다.
         * 기간 시작 전 항목도 담는다 — 이월됐거나 늦게 도착한 항목이 다음 정산서로 들어오는 경로다.
         * 담을 것이 없으면 null — 정산서를 만들지 않는다.
         */
        fun draft(
            sellerId: Long,
            period: SettlementPeriod,
            candidates: List<SettlementItem>,
            refundedKeys: Set<String>,
            now: Instant,
        ): SettlementStatement? {
            val lines = candidates
                .filter { it.sellerId == sellerId && it.confirmedAt < period.endInstant && it.key !in refundedKeys }
                .sortedWith(compareBy({ it.confirmedAt }, { it.key }))
            if (lines.isEmpty()) return null
            return SettlementStatement(null, sellerId, period, StatementStatus.DRAFT, lines, now, null, null, null, null)
        }

        fun restore(
            id: Long,
            sellerId: Long,
            period: SettlementPeriod,
            status: StatementStatus,
            lines: List<SettlementItem>,
            createdAt: Instant,
            confirmedAt: Instant?,
            paidAt: Instant?,
            carriedOverAt: Instant?,
            payoutReference: String?,
        ) = SettlementStatement(id, sellerId, period, status, lines, createdAt, confirmedAt, paidAt, carriedOverAt, payoutReference)
    }
}
