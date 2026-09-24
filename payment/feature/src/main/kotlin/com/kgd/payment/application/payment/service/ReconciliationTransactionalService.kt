package com.kgd.payment.application.payment.service

import com.kgd.payment.application.opsissue.port.OpsIssueRepositoryPort
import com.kgd.payment.application.payment.port.PaymentEventPort
import com.kgd.payment.application.payment.port.PgSettlementLine
import com.kgd.payment.application.payment.port.ReconciliationRepositoryPort
import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.reconciliation.model.ReconciliationRecord
import com.kgd.payment.domain.reconciliation.model.ReconciliationResult
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDate

/** 대사 한 건의 판정 기록 + (일치) settled 아웃박스 행 · (불일치) 운영 이슈 행 — 한 트랜잭션 */
@Service
class ReconciliationTransactionalService(
    private val reconciliations: ReconciliationRepositoryPort,
    private val opsIssues: OpsIssueRepositoryPort,
    private val events: PaymentEventPort,
    @Qualifier("paymentClock") private val clock: Clock,
) {
    @Transactional("paymentTransactionManager")
    fun matched(settleDate: LocalDate, payment: Payment, line: PgSettlementLine) {
        reconciliations.save(
            ReconciliationRecord(settleDate, line.orderNo, ReconciliationResult.MATCHED, line.grossAmount, line.pgFee, clock.instant()),
        )
        events.publishSettled(payment, settleDate, line)
    }

    @Transactional("paymentTransactionManager")
    fun mismatched(settleDate: LocalDate, orderNo: String, detail: String) {
        val now = clock.instant()
        reconciliations.save(ReconciliationRecord(settleDate, orderNo, ReconciliationResult.MISMATCH, null, null, now))
        opsIssues.save(OpsIssue.open(OpsIssueType.RECON_MISMATCH, orderNo, detail, settleDate, now))
    }
}
