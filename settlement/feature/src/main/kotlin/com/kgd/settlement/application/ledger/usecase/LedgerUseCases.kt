package com.kgd.settlement.application.ledger.usecase

import com.kgd.settlement.application.ledger.port.AccountBalance
import com.kgd.settlement.domain.ledger.model.Journal
import com.kgd.settlement.domain.ledger.model.LineAmounts
import com.kgd.settlement.domain.ledger.model.ShippingAmount
import java.time.Instant
import java.time.LocalDate

/**
 * 원천 이벤트 → 원장 거래. 같은 원천(주문·클레임·대사 건)은 한 번만 기록된다 — 이벤트가 다시 와도, 새 이벤트 id 로 다시 발행돼도.
 * 반환값: 이번 호출이 거래를 새로 남겼는가.
 */
interface RecordLedgerUseCase {
    fun recordCapture(command: Capture): Boolean
    fun recordRefund(command: Refund): Boolean
    fun recordPgDeposit(command: PgDeposit): Boolean

    data class Capture(
        val orderId: Long,
        val payableAmount: Long,
        val lines: List<LineAmounts>,
        val shipping: List<ShippingAmount>,
        val confirmedAt: Instant,
        val eventId: String?,
    )

    data class Refund(
        val claimId: Long,
        val orderId: Long,
        val refundAmount: Long,
        val lines: List<LineAmounts>,
        val shipping: List<ShippingAmount>,
        val refundedAt: Instant,
        val eventId: String?,
    )

    data class PgDeposit(
        val orderId: Long,
        val orderNo: String,
        val settleDate: LocalDate,
        val depositAmount: Long,
        val pgFee: Long,
        val eventId: String?,
    )
}

/**
 * 어드민 정정 — 원장 거래 하나를 역분개한다. 한 거래는 한 번만 역분개되고(원천 키 `reversal:journal:{id}` 유니크),
 * 이미 역분개된 거래를 다시 요청하면 기존 역분개 거래를 돌려준다. 행위자·사유를 역분개 거래에 남긴다.
 */
interface ReverseJournalUseCase {
    fun reverse(journalId: Long, actorId: String, reason: String): Journal
}

/** 시산표 — 계정별 (차 − 대), 전체 합은 0 이어야 한다 */
interface GetTrialBalanceUseCase {
    fun trialBalance(): TrialBalance
}

data class TrialBalance(
    val accounts: List<AccountBalance>,
    val sellerPayables: List<SellerPayable>,
) {
    val totalDebit: Long get() = accounts.sumOf { it.debit }
    val totalCredit: Long get() = accounts.sumOf { it.credit }

    /** 0 이 아니면 원장 어딘가가 깨졌다 */
    val net: Long get() = totalDebit - totalCredit
}

/** 판매자 미지급금 잔액(대 − 차) — 아직 지급하지 않은 판매 대금 */
data class SellerPayable(val sellerId: Long, val balance: Long)
