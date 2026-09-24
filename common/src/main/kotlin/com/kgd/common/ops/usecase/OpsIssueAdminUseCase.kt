package com.kgd.common.ops.usecase

/**
 * 도메인 운영 이슈의 어드민 조치 — 조회·재시도·종결. 도메인마다 한 벌(자기 스키마의 `ops_issue`)이고,
 * 응답 모양은 전 도메인이 같다(운영 큐 화면이 도메인 목록을 합친다 — payment 의 응답과도 같은 모양).
 */
interface OpsIssueAdminUseCase {
    fun list(status: String?, type: String?, page: Int, size: Int): OpsIssuePageView

    /** 종류별 재시도(DLT 는 원 토픽 재발행)를 실행한 뒤 RETRIED 로 둔다. 실행이 실패하면 상태를 바꾸지 않는다 */
    fun retry(id: Long, actorId: String, reason: String?): OpsIssueView

    fun close(id: Long, actorId: String, reason: String): OpsIssueView
}

data class OpsIssueView(
    val id: Long,
    val type: String,
    val targetId: String,
    val detail: String,
    val businessDate: String?,
    val status: String,
    val actorId: String?,
    val reason: String?,
    val createdAt: String,
    val updatedAt: String,
)

data class OpsIssuePageView(val items: List<OpsIssueView>, val total: Long)
