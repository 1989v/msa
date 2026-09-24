package com.kgd.payment.application.opsissue.usecase

import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus

interface QueryOpsIssuesUseCase {
    fun list(status: OpsIssueStatus?, page: Int, size: Int): OpsIssuePageView
}

/**
 * 어드민 조치 — 재시도·종결. 재시도는 종류별로 다르다:
 * PAYMENT_UNKNOWN 은 재조회를 처음부터 다시 잡고, RECON_MISMATCH 는 그 날짜·주문번호를 다시 대사한다.
 */
interface ManageOpsIssueUseCase {
    fun retry(id: Long, actorId: String): OpsIssueView
    fun close(id: Long, actorId: String, reason: String): OpsIssueView
}

data class OpsIssueView(
    val id: Long,
    val type: String,
    val targetId: String,
    val detail: String,
    val businessDate: String?,
    val status: OpsIssueStatus,
    val actorId: String?,
    val reason: String?,
    val createdAt: String,
    val updatedAt: String,
) {
    companion object {
        fun from(i: OpsIssue) = OpsIssueView(
            id = requireNotNull(i.id), type = i.type.name, targetId = i.targetId, detail = i.detail,
            businessDate = i.businessDate?.toString(), status = i.status, actorId = i.actorId, reason = i.reason,
            createdAt = i.createdAt.toString(), updatedAt = i.updatedAt.toString(),
        )
    }
}

data class OpsIssuePageView(val items: List<OpsIssueView>, val total: Long)
