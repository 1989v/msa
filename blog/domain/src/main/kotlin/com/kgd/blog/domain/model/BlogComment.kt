package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 댓글. 대댓글은 1단계까지만 — 깊이를 열어 두면 화면이 감당하지 못하고,
 * 모바일에서는 3단만 되어도 읽을 수 없게 된다.
 */
data class BlogComment(
    val id: Long?,
    val postId: Long,
    val profileId: Long,
    val parentId: Long?,
    val body: String,
    val status: CommentStatus,
    val createdAt: LocalDateTime? = null,
    val updatedAt: LocalDateTime? = null,
) {
    init {
        validateBody(body)
    }

    fun edit(body: String): BlogComment = copy(body = validateBody(body))

    /**
     * 소프트 삭제. 행은 남기고 본문만 비운다 — 행을 지우면 대댓글이 부모를 잃고,
     * 본문을 남기면 "삭제했다"는 사용자의 의사가 지켜지지 않는다.
     */
    fun softDelete(): BlogComment = copy(status = CommentStatus.DELETED, body = DELETED_PLACEHOLDER)

    fun withStatus(status: CommentStatus): BlogComment = copy(status = status)

    fun isOwnedBy(profileId: Long?): Boolean = profileId != null && profileId == this.profileId

    fun requireEditableBy(profileId: Long?, isAdmin: Boolean) {
        if (!isAdmin && !isOwnedBy(profileId)) {
            throw BusinessException(ErrorCode.FORBIDDEN, "본인이 작성한 댓글만 수정할 수 있습니다")
        }
    }

    companion object {
        const val MAX_BODY = 2000

        /** 소프트 삭제된 댓글의 표시 문구. 행을 지우면 대댓글이 부모를 잃는다 */
        const val DELETED_PLACEHOLDER = "삭제된 댓글입니다"

        /**
         * 저장 직전의 본문 정규화 + 검증. 컨트롤러의 `@Size` 와 규칙이 갈리면 어느 쪽이
         * 진짜인지 알 수 없게 되므로, 실제로 저장되는 값은 항상 여기를 통과한 것이다.
         */
        fun validateBody(body: String): String {
            val trimmed = body.trim()
            if (trimmed.isEmpty() || trimmed.length > MAX_BODY) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "댓글은 1~$MAX_BODY 자여야 합니다")
            }
            return trimmed
        }

        /** 대댓글의 부모는 반드시 최상위 댓글이어야 한다 (1단계 제한을 도메인이 강제) */
        fun requireTopLevelParent(parent: BlogComment) {
            if (parent.parentId != null) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "대댓글에는 다시 답글을 달 수 없습니다")
            }
        }
    }
}
