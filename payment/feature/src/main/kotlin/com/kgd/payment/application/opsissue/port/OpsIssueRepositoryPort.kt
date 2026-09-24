package com.kgd.payment.application.opsissue.port

import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus

interface OpsIssueRepositoryPort {
    fun save(issue: OpsIssue): OpsIssue
    fun findById(id: Long): OpsIssue?
    fun findPage(status: OpsIssueStatus?, page: Int, size: Int): OpsIssuePage
}

/** DLT 이슈에 남긴 레코드를 원 토픽으로 다시 보낸다 */
interface DltReplayPort {
    fun replay(issueId: Long)
}

data class OpsIssuePage(val items: List<OpsIssue>, val total: Long)
