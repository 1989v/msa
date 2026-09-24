package com.kgd.payment.application.opsissue.port

import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus

interface OpsIssueRepositoryPort {
    fun save(issue: OpsIssue): OpsIssue
    fun findById(id: Long): OpsIssue?
    fun findPage(status: OpsIssueStatus?, page: Int, size: Int): OpsIssuePage
}

data class OpsIssuePage(val items: List<OpsIssue>, val total: Long)
