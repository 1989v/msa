package com.kgd.settlement.application.statement.usecase

import com.kgd.settlement.domain.ledger.model.LineAmounts
import com.kgd.settlement.domain.ledger.model.ShippingAmount
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import java.time.Instant

/** `order.line.purchase-confirmed` → 정산 대상 항목. [shipping] 은 그 판매자의 첫 확정 라인일 때만 실린다 */
interface RegisterSettlementItemUseCase {
    fun register(command: PurchaseConfirmed)

    data class PurchaseConfirmed(
        val orderId: Long,
        val line: LineAmounts,
        val shipping: ShippingAmount?,
        val confirmedAt: Instant,
    )
}

/** 정산 배치 — 주기가 닫힌 판매자마다 정산서 → 확정 → 지급(또는 이월) */
interface RunSettlementBatchUseCase {
    fun run(): BatchResult

    data class BatchResult(val opened: Int, val paid: Int, val carriedOver: Int, val failed: Int, val platformRetained: Int = 0)
}

/** 확정됐는데 지급이 끝나지 않은 정산서(송금 뒤 장애 등)의 지급을 다시 한다 */
interface RetryPayoutUseCase {
    fun retry(statementId: Long): SettlementStatement
}

interface GetStatementsUseCase {
    /** 판매자 포털 — ACTIVE 판매자 본인 것만. 판매자가 아니거나 ACTIVE 가 아니면 403 */
    fun forSeller(memberId: String): List<SettlementStatement>

    /** 남의 정산서는 404 (존재를 알리지 않는다) */
    fun forSellerDetail(memberId: String, statementId: Long): SettlementStatement

    fun search(status: StatementStatus?, sellerId: Long?): List<SettlementStatement>

    fun detail(statementId: Long): SettlementStatement
}
