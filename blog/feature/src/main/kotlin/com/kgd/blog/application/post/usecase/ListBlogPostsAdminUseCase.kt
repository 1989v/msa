package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.domain.model.PostStatus

interface ListBlogPostsAdminUseCase {
    fun execute(query: Query): BlogPage<BlogPostSummary>

    data class Query(val status: PostStatus?, val page: Int, val size: Int)
}
