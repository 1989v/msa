package com.kgd.blog.application.comment.usecase

import com.kgd.blog.application.comment.dto.BlogCommentAdminResponse
import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.domain.model.CommentStatus

interface ListBlogCommentsAdminUseCase {
    fun execute(query: Query): BlogPage<BlogCommentAdminResponse>

    data class Query(val status: CommentStatus?, val page: Int, val size: Int)
}
