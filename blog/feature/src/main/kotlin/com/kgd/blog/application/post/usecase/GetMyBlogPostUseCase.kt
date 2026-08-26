package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.profile.dto.BlogIdentity

/** 초안 미리보기 — 소유자·어드민에게만 */
interface GetMyBlogPostUseCase {
    fun execute(query: Query): BlogPostDetail

    data class Query(val postId: Long, val identity: BlogIdentity)
}
