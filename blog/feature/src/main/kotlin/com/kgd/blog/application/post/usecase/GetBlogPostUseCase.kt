package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.profile.dto.BlogIdentity

/** 공개 상세. 미발행 슬러그는 존재를 드러내지 않고 404 */
interface GetBlogPostUseCase {
    fun execute(query: Query): BlogPostDetail

    data class Query(val slug: String, val identity: BlogIdentity)
}
