package com.kgd.settlement.application.ledger.service

import com.kgd.settlement.application.ledger.port.AccountBalance
import com.kgd.settlement.application.ledger.port.JournalRepositoryPort
import com.kgd.settlement.application.ledger.usecase.GetTrialBalanceUseCase
import com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase
import com.kgd.settlement.application.ledger.usecase.SellerPayable
import com.kgd.settlement.application.ledger.usecase.TrialBalance
import com.kgd.settlement.application.statement.port.RefundedItemRepositoryPort
import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.Journal
import com.kgd.settlement.domain.ledger.model.JournalRules
import com.kgd.settlement.domain.statement.model.SettlementItem
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock

/**
 * 원천 이벤트를 분개 규칙(JournalRules)대로 원장에 남긴다. 멱등은 원천 키 — 컨슈머의 이벤트 id 원장이 첫 겹,
 * 여기 원천 키 확인과 저장소 유니크가 둘째 겹이다(같은 주문이 새 이벤트 id 로 다시 발행돼도 거래는 하나).
 */
@Service
class LedgerService(
    private val journals: JournalRepositoryPort,
    private val refundedItems: RefundedItemRepositoryPort,
    @Qualifier("settlementClock") private val clock: Clock,
) : RecordLedgerUseCase, GetTrialBalanceUseCase {
    private val log = KotlinLogging.logger {}

    @Transactional("settlementTransactionManager")
    override fun recordCapture(command: RecordLedgerUseCase.Capture): Boolean = append(
        JournalRules.capture(command.orderId, command.payableAmount, command.lines, command.shipping, command.eventId, command.confirmedAt),
    )

    /** 환불 거래 + 환불된 라인·배송비 키 — 한 트랜잭션. 키는 정산서가 그 항목을 거르는 근거다 */
    @Transactional("settlementTransactionManager")
    override fun recordRefund(command: RecordLedgerUseCase.Refund): Boolean {
        val recorded = append(
            JournalRules.refund(
                command.claimId, command.orderId, command.refundAmount, command.lines, command.shipping, command.eventId, command.refundedAt,
            ),
        )
        val keys = command.lines.map { SettlementItem.lineKey(it.orderItemId) } +
            command.shipping.map { SettlementItem.shippingKey(command.orderId, it.sellerId) }
        refundedItems.markRefunded(keys, command.claimId, command.refundedAt)
        return recorded
    }

    @Transactional("settlementTransactionManager")
    override fun recordPgDeposit(command: RecordLedgerUseCase.PgDeposit): Boolean = append(
        JournalRules.pgDeposit(
            command.orderId, command.orderNo, command.settleDate, command.depositAmount, command.pgFee, command.eventId, clock.instant(),
        ),
    )

    @Transactional("settlementTransactionManager", readOnly = true)
    override fun trialBalance(): TrialBalance {
        val sums = journals.sumByAccount().associateBy { it.account }
        return TrialBalance(
            accounts = Account.entries.map { sums[it] ?: AccountBalance(it, 0L, 0L) },
            sellerPayables = journals.sellerPayableBalances().map { (sellerId, balance) -> SellerPayable(sellerId, balance) }
                .sortedBy { it.sellerId },
        )
    }

    private fun append(journal: Journal): Boolean {
        if (journals.existsBySourceKey(journal.sourceKey)) {
            log.info { "이미 기록된 원천 — 건너뛴다: ${journal.sourceKey} (event ${journal.sourceEventId})" }
            return false
        }
        journals.append(journal)
        return true
    }
}
