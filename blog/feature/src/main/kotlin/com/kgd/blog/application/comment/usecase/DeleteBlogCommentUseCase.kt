package com.kgd.blog.application.comment.usecase

import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.profile.dto.BlogIdentity

/** 소프트 삭제 — 행은 남기고 본문만 비운다 */
interface DeleteBlogCommentUseCase {
    fun execute(command: Command): List<BlogCommentNode>

    data class Command(val commentId: Long, val identity: BlogIdentity)
}
