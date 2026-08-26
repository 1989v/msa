package com.kgd.blog.application.comment.usecase

import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.profile.dto.BlogIdentity

interface EditBlogCommentUseCase {
    fun execute(command: Command): List<BlogCommentNode>

    data class Command(val commentId: Long, val body: String, val identity: BlogIdentity)
}
