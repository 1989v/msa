package com.kgd.blog.application.comment.usecase

import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.comment.dto.BlogCommentRequest
import com.kgd.blog.application.profile.dto.BlogIdentity

interface CreateBlogCommentUseCase {
    fun execute(command: Command): List<BlogCommentNode>

    data class Command(val request: BlogCommentRequest, val identity: BlogIdentity)
}
