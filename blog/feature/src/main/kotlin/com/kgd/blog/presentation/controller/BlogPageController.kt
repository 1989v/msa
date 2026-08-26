package com.kgd.blog.presentation.controller

import com.kgd.blog.application.post.usecase.RenderBlogPageUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController

/**
 * 글 상세·작성자 공간의 **HTML** 응답 (ADR-0072 §6).
 *
 * `/api` 밑이 아닌 이유는 이 주소가 공유되기 때문이다 — deal 의 `/go` 와 같은 판단.
 * ingress 는 blog 호스트에만 이 prefix 를 연다. 다른 호스트에 열면 같은 글이 두 주소로
 * 돌아다녀 canonical 이 갈린다.
 *
 * SPA 는 이 HTML 위에서 그대로 마운트된다 — 셸이 portal-fe 의 실제 index.html 이라
 * 자산 경로가 항상 최신이다.
 */
@RestController
class BlogPageController(
    private val renderPage: RenderBlogPageUseCase,
) {

    @GetMapping("/posts/{slug}", produces = [MediaType.TEXT_HTML_VALUE])
    fun postPage(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ResponseEntity<String> = respond(
        renderPage.postPage(
            RenderBlogPageUseCase.PostCommand(
                slug = slug,
                identity = BlogIdentity.of(userId, roles, visitorId),
                userAgent = userAgent,
            ),
        ),
    )

    @GetMapping("/authors/{handle}", produces = [MediaType.TEXT_HTML_VALUE])
    fun authorPage(@PathVariable handle: String): ResponseEntity<String> =
        respond(renderPage.authorPage(handle))

    private fun respond(page: RenderBlogPageUseCase.Page): ResponseEntity<String> {
        val status = when (page) {
            is RenderBlogPageUseCase.Page.Found -> 200
            is RenderBlogPageUseCase.Page.NotFound -> 404
        }
        return ResponseEntity.status(status)
            .contentType(MediaType.TEXT_HTML)
            // HTML 은 항상 재검증 — 발행 직후 CDN 이 옛 메타를 계속 내보내면 서버 렌더를 한 이유가 없다
            .header(HttpHeaders.CACHE_CONTROL, "no-cache, must-revalidate")
            .body(page.html)
    }
}
