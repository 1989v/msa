package com.kgd.order.domain.opsissue.model

import java.time.Instant

enum class OpsIssueStatus { OPEN, RETRIED, CLOSED }

enum class OpsIssueType {
    /** 사가 단계가 재시도 한도를 넘었다 */
    SAGA_STUCK,
}

/** order 스키마의 운영 이슈 한 건 — 사람이 봐야 하는 것. 조회·재시도·종결 API 는 운영 큐 단계에서 붙는다 */
class OpsIssue private constructor(
    val id: Long?,
    val type: OpsIssueType,
    /** 대상 식별자 — 사가는 orderId */
    val targetId: String,
    val detail: String,
    val status: OpsIssueStatus,
    val createdAt: Instant,
) {
    companion object {
        fun open(type: OpsIssueType, targetId: String, detail: String, now: Instant) =
            OpsIssue(null, type, targetId, detail.take(1000), OpsIssueStatus.OPEN, now)

        fun restore(id: Long?, type: OpsIssueType, targetId: String, detail: String, status: OpsIssueStatus, createdAt: Instant) =
            OpsIssue(id, type, targetId, detail, status, createdAt)
    }
}
