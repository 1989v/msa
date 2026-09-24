package com.kgd.order.infrastructure.persistence.opsissue.adapter

import com.kgd.order.application.saga.port.OrderOpsIssueRepositoryPort
import com.kgd.order.domain.opsissue.model.OpsIssue
import com.kgd.order.infrastructure.persistence.opsissue.entity.OrderOpsIssueJpaEntity
import com.kgd.order.infrastructure.persistence.opsissue.repository.OrderOpsIssueJpaRepository
import org.springframework.stereotype.Component

@Component
class OrderOpsIssueRepositoryAdapter(
    private val jpa: OrderOpsIssueJpaRepository,
) : OrderOpsIssueRepositoryPort {
    override fun save(issue: OpsIssue) {
        jpa.save(
            OrderOpsIssueJpaEntity(
                type = issue.type, targetId = issue.targetId, detail = issue.detail, status = issue.status,
                createdAt = issue.createdAt, updatedAt = issue.createdAt,
            ),
        )
    }
}
