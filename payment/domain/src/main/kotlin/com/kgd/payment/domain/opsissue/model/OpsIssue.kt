package com.kgd.payment.domain.opsissue.model

import com.kgd.payment.domain.opsissue.exception.InvalidOpsIssueStateException
import java.time.Instant
import java.time.LocalDate

/**
 * 사람이 봐야 하는 건 하나. OPEN → RETRIED(여러 번 가능) → CLOSED. CLOSED 는 종착.
 * 재시도·종결은 처리자([actorId])를, 종결은 사유를 남긴다.
 */
class OpsIssue private constructor(
    val id: Long?,
    val type: OpsIssueType,
    /** 대상 식별자 — 결제는 가맹점 주문번호 */
    val targetId: String,
    val detail: String,
    /** 대사처럼 날짜가 붙는 이슈의 기준일 */
    val businessDate: LocalDate?,
    status: OpsIssueStatus,
    actorId: String?,
    reason: String?,
    val createdAt: Instant,
    updatedAt: Instant,
) {
    var status: OpsIssueStatus = status
        private set
    var actorId: String? = actorId
        private set
    var reason: String? = reason
        private set
    var updatedAt: Instant = updatedAt
        private set

    fun retry(actorId: String, now: Instant, reason: String? = null) {
        if (status == OpsIssueStatus.CLOSED) throw InvalidOpsIssueStateException(status, "RETRY")
        status = OpsIssueStatus.RETRIED
        this.actorId = actorId
        if (reason != null) this.reason = reason
        updatedAt = now
    }

    fun close(actorId: String, reason: String, now: Instant) {
        require(reason.isNotBlank()) { "종결 사유가 필요합니다" }
        if (status == OpsIssueStatus.CLOSED) throw InvalidOpsIssueStateException(status, "CLOSE")
        status = OpsIssueStatus.CLOSED
        this.actorId = actorId
        this.reason = reason
        updatedAt = now
    }

    companion object {
        fun open(type: OpsIssueType, targetId: String, detail: String, businessDate: LocalDate?, now: Instant) =
            OpsIssue(null, type, targetId, detail, businessDate, OpsIssueStatus.OPEN, null, null, now, now)

        fun restore(
            id: Long?,
            type: OpsIssueType,
            targetId: String,
            detail: String,
            businessDate: LocalDate?,
            status: OpsIssueStatus,
            actorId: String?,
            reason: String?,
            createdAt: Instant,
            updatedAt: Instant,
        ) = OpsIssue(id, type, targetId, detail, businessDate, status, actorId, reason, createdAt, updatedAt)
    }
}

enum class OpsIssueStatus { OPEN, RETRIED, CLOSED }

enum class OpsIssueType {
    /** 결과 미상 결제가 재조회 5회로도 결론 나지 않았다 */
    PAYMENT_UNKNOWN,

    /** PG 정산 파일과 결제 행이 어긋나거나 한쪽에만 있다 */
    RECON_MISMATCH,

    /** 결제 컨슈머가 처리하지 못해 DLT 로 간 레코드 — 대상 id 는 원 토픽@파티션:오프셋, 재시도는 원 토픽 재발행 */
    DLT,
}
