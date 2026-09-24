package com.kgd.payment.application.opsissue.service

import com.kgd.payment.application.opsissue.port.OpsIssueRepositoryPort
import com.kgd.payment.application.opsissue.usecase.ManageOpsIssueUseCase
import com.kgd.payment.application.opsissue.usecase.OpsIssuePageView
import com.kgd.payment.application.opsissue.usecase.OpsIssueView
import com.kgd.payment.application.opsissue.usecase.QueryOpsIssuesUseCase
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import org.springframework.stereotype.Service

@Service
class OpsIssueService(
    private val opsIssues: OpsIssueRepositoryPort,
    private val tx: OpsIssueTransactionalService,
    private val reconcile: ReconcilePaymentsUseCase,
) : QueryOpsIssuesUseCase, ManageOpsIssueUseCase {

    override fun list(status: OpsIssueStatus?, page: Int, size: Int): OpsIssuePageView =
        opsIssues.findPage(status, page, size).let { OpsIssuePageView(it.items.map(OpsIssueView::from), it.total) }

    /** 대사 재시도는 정산 파일을 다시 읽는다(외부 IO) — 이슈 갱신 트랜잭션이 끝난 뒤에 돈다 */
    override fun retry(id: Long, actorId: String): OpsIssueView {
        val issue = tx.retry(id, actorId)
        if (issue.type == OpsIssueType.RECON_MISMATCH) reconcile.reconcile(requireNotNull(issue.businessDate))
        return OpsIssueView.from(issue)
    }

    override fun close(id: Long, actorId: String, reason: String): OpsIssueView =
        OpsIssueView.from(tx.close(id, actorId, reason))
}
