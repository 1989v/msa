package com.kgd.order.infrastructure.persistence.opsissue.adapter

import com.kgd.common.ops.OpsIssueStore
import com.kgd.order.application.saga.port.OrderOpsIssueRepositoryPort
import com.kgd.order.domain.opsissue.model.OpsIssue
import com.kgd.order.domain.opsissue.model.OpsIssueType
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component

/**
 * order 스키마 `ops_issue` — 운영 큐의 공통 저장소([OpsIssueStore])로 쓴다. 저장소는 order EMF 의 DataSource 를 쓰므로
 * 코디네이터 트랜잭션 안에서 부르면 사가 STUCK 전이와 같은 커밋에 묶인다.
 */
@Component
class OrderOpsIssueRepositoryAdapter(
    @Qualifier("orderOpsIssueStore") private val store: OpsIssueStore,
) : OrderOpsIssueRepositoryPort {
    override fun save(issue: OpsIssue) {
        store.open(issue.type.name, issue.targetId, issue.detail)
    }

    override fun hasOpen(type: OpsIssueType, targetId: String): Boolean = store.hasOpen(type.name, targetId)
}
