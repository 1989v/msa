package com.kgd.payment.application.opsissue.service

import com.kgd.common.exception.NotFoundException
import com.kgd.payment.application.opsissue.port.OpsIssueRepositoryPort
import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.application.payment.port.ReconciliationRepositoryPort
import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import com.kgd.payment.domain.payment.model.PaymentStatus
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock

@Service
class OpsIssueTransactionalService(
    private val opsIssues: OpsIssueRepositoryPort,
    private val payments: PaymentRepositoryPort,
    private val reconciliations: ReconciliationRepositoryPort,
    @Qualifier("paymentClock") private val clock: Clock,
) {
    /**
     * 이슈를 RETRIED 로 두고 재시도 준비를 한다 — PAYMENT_UNKNOWN 은 재조회를 처음부터 잡고(아직 UNKNOWN 일 때만),
     * RECON_MISMATCH 는 그 판정을 지워 다음 대사가 다시 보게 한다.
     */
    @Transactional("paymentTransactionManager")
    fun retry(id: Long, actorId: String): OpsIssue {
        val issue = load(id)
        val now = clock.instant()
        issue.retry(actorId, now)
        when (issue.type) {
            OpsIssueType.PAYMENT_UNKNOWN ->
                payments.findByOrderNo(issue.targetId)
                    ?.takeIf { it.status == PaymentStatus.UNKNOWN }
                    ?.let { it.retryInquiry(now); payments.save(it) }
            OpsIssueType.RECON_MISMATCH ->
                reconciliations.delete(requireNotNull(issue.businessDate) { "대사 이슈에 정산일이 없다" }, issue.targetId)
        }
        return opsIssues.save(issue)
    }

    @Transactional("paymentTransactionManager")
    fun close(id: Long, actorId: String, reason: String): OpsIssue {
        val issue = load(id)
        issue.close(actorId, reason, clock.instant())
        return opsIssues.save(issue)
    }

    private fun load(id: Long): OpsIssue = opsIssues.findById(id) ?: throw NotFoundException("OpsIssue", id)
}
