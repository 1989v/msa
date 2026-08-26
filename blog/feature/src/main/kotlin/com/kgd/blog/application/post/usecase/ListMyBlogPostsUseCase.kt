package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.domain.model.PostStatus

/** 자기 것만 — 목록 쿼리 자체가 작성자로 좁혀진다 */
interface ListMyBlogPostsUseCase {
    fun execute(query: Query): BlogPage<BlogPostSummary>

    data class Query(val identity: BlogIdentity, val status: PostStatus?, val page: Int, val size: Int)
}
