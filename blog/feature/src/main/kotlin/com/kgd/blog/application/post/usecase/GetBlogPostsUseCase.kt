package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostSummary

/**
 * 발행글 목록. `categoryPath` 는 서브트리를 통째로 받는다.
 * `concept` 가 있으면 그 개념에 매핑된 글만 — 다른 필터와 겹쳐 쓰지 않는다(개념 화면 전용).
 */
interface GetBlogPostsUseCase {
    fun execute(query: Query): BlogPage<BlogPostSummary>

    data class Query(
        val categoryPath: String?,
        val handle: String?,
        val page: Int,
        val size: Int,
        val concept: String? = null,
    )
}
