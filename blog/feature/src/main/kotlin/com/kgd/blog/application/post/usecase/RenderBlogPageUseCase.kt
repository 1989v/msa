package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.profile.dto.BlogIdentity

/**
 * 글 상세·작성자 공간의 HTML 응답 (ADR-0072 §6).
 *
 * 없는 글도 HTML 을 돌려준다 — 셸 위에 404 본문을 얹어야 공유 카드가 깨지지 않는다.
 * 그래서 결과가 [Page.Found] / [Page.NotFound] 로 갈린다.
 */
interface RenderBlogPageUseCase {
    fun postPage(command: PostCommand): Page
    fun authorPage(handle: String): Page

    data class PostCommand(
        val slug: String,
        val identity: BlogIdentity,
        val userAgent: String?,
    )

    sealed interface Page {
        val html: String

        data class Found(override val html: String) : Page
        data class NotFound(override val html: String) : Page
    }
}
