package com.kgd.common.ops

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.NotFoundException
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import com.kgd.common.ops.usecase.OpsIssuePageView
import com.kgd.common.ops.usecase.OpsIssueView
import io.github.oshai.kotlinlogging.KotlinLogging

/**
 * 한 도메인의 운영 이슈 어드민. 재시도는 종류별 [retryHandlers] 가 한다 — DLT 는 원 토픽 재발행, 사가·클레임 체류는 재개.
 * 재시도 실행이 끝난 뒤에 RETRIED 로 둔다 — 실행이 실패하면 이슈는 OPEN 그대로라 다시 누를 수 있다.
 * 조치마다 처리자·사유를 행에 남기고 로그에도 한 줄 쓴다.
 */
class OpsIssueAdminService(
    private val domain: String,
    private val store: OpsIssueStore,
    private val retryHandlers: Map<String, (OpsIssueView) -> Unit>,
) : OpsIssueAdminUseCase {
    private val log = KotlinLogging.logger {}

    override fun list(status: String?, type: String?, page: Int, size: Int): OpsIssuePageView =
        store.page(status?.takeIf { it.isNotBlank() }, type?.takeIf { it.isNotBlank() }, page.coerceAtLeast(0), size.coerceIn(1, 100))

    override fun retry(id: Long, actorId: String, reason: String?): OpsIssueView {
        val issue = load(id)
        if (issue.status == OpsIssueStore.CLOSED) throw closed(id, "RETRY")
        val handler = retryHandlers[issue.type]
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "재시도할 방법이 없는 운영 이슈입니다: ${issue.type}")
        handler(issue)
        if (!store.markRetried(id, actorId, reason)) throw closed(id, "RETRY")
        log.info { "운영 이슈 재시도: domain=$domain, id=$id, type=${issue.type}, target=${issue.targetId}, actor=$actorId, reason=$reason" }
        return load(id)
    }

    override fun close(id: Long, actorId: String, reason: String): OpsIssueView {
        if (reason.isBlank()) throw BusinessException(ErrorCode.INVALID_INPUT, "종결 사유가 필요합니다")
        load(id)
        if (!store.close(id, actorId, reason)) throw closed(id, "CLOSE")
        log.info { "운영 이슈 종결: domain=$domain, id=$id, actor=$actorId, reason=$reason" }
        return load(id)
    }

    private fun load(id: Long): OpsIssueView = store.find(id) ?: throw NotFoundException("OpsIssue", id)

    private fun closed(id: Long, action: String) =
        BusinessException(ErrorCode.INVALID_OPS_ISSUE_STATUS, "운영 이슈 상태 전이 불가: CLOSED → $action (id=$id)")

    companion object {
        /** DLT 재발행만 하는 도메인의 기본 구성 */
        fun dltOnly(domain: String, store: OpsIssueStore, replayer: DltReplayer): OpsIssueAdminService =
            OpsIssueAdminService(domain, store, mapOf(DltOpsIssueRecorder.DLT to { issue -> replayer.replay(issue.id) }))
    }
}
