package com.kgd.settlement.presentation.statement.dto

import com.kgd.settlement.application.statement.usecase.RunSettlementBatchUseCase
import com.kgd.settlement.domain.statement.model.SettlementItem
import com.kgd.settlement.domain.statement.model.SettlementStatement
import java.time.Instant
import java.time.LocalDate

/** 정산서. [periodEnd] 는 마지막 날(포함). [lines] 는 상세에서만 채운다 */
data class StatementResponse(
    val id: Long,
    val sellerId: Long,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val status: String,
    val netSales: Long,
    val shippingFee: Long,
    val commission: Long,
    val payout: Long,
    val payoutReference: String?,
    val lineCount: Int,
    val createdAt: Instant,
    val confirmedAt: Instant?,
    val paidAt: Instant?,
    val carriedOverAt: Instant?,
    val lines: List<StatementLineResponse>?,
) {
    companion object {
        fun of(s: SettlementStatement, withLines: Boolean) = StatementResponse(
            id = requireNotNull(s.id), sellerId = s.sellerId, periodStart = s.period.start, periodEnd = s.period.lastDay,
            status = s.status.name, netSales = s.netSales, shippingFee = s.shippingFee, commission = s.commission, payout = s.payout,
            payoutReference = s.payoutReference, lineCount = s.lines.size, createdAt = s.createdAt, confirmedAt = s.confirmedAt,
            paidAt = s.paidAt, carriedOverAt = s.carriedOverAt,
            lines = if (withLines) s.lines.map(StatementLineResponse::of) else null,
        )
    }
}

data class StatementLineResponse(
    val kind: String,
    val orderId: Long,
    val orderItemId: Long?,
    val netSales: Long,
    val commission: Long,
    val shippingFee: Long,
    val payout: Long,
    val confirmedAt: Instant,
) {
    companion object {
        fun of(i: SettlementItem) = StatementLineResponse(
            kind = i.kind.name, orderId = i.orderId, orderItemId = i.orderItemId, netSales = i.netSales,
            commission = i.commission, shippingFee = i.shippingFee, payout = i.payout, confirmedAt = i.confirmedAt,
        )
    }
}

data class BatchRunResponse(val opened: Int, val paid: Int, val carriedOver: Int, val failed: Int) {
    companion object {
        fun of(r: RunSettlementBatchUseCase.BatchResult) = BatchRunResponse(r.opened, r.paid, r.carriedOver, r.failed)
    }
}
