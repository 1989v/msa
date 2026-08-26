package com.kgd.blog.application.comment.usecase

import com.kgd.blog.domain.model.CommentStatus

/** 모더레이션 — 숨김/복구 */
interface ChangeBlogCommentStatusUseCase {
    fun execute(command: Command)

    data class Command(val commentId: Long, val status: CommentStatus)
}
