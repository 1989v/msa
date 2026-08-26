package com.kgd.blog.presentation.controller

import com.kgd.blog.application.interaction.usecase.RecordBlogViewUseCase
import com.kgd.blog.application.post.usecase.GetBlogAuthorSpaceUseCase
import com.kgd.blog.application.post.usecase.GetBlogPostUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.infrastructure.render.BlogMetaRenderer
import com.kgd.blog.infrastructure.render.ShellHtmlProvider
import com.kgd.common.exception.BusinessException
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
    private val getPost: GetBlogPostUseCase,
    private val getAuthorSpace: GetBlogAuthorSpaceUseCase,
    private val recordView: RecordBlogViewUseCase,
    private val shellProvider: ShellHtmlProvider,
    private val renderer: BlogMetaRenderer,
) {

    @GetMapping("/posts/{slug}", produces = [MediaType.TEXT_HTML_VALUE])
    fun postPage(
        @PathVariable slug: String,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
        @RequestHeader(value = "X-Visitor-Id", required = false) visitorId: String?,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ResponseEntity<String> {
        val shell = shellProvider.shell()
        val identity = BlogIdentity.of(userId, roles, visitorId)
        val detail = try {
            getPost.execute(GetBlogPostUseCase.Query(slug, identity))
        } catch (e: BusinessException) {
            return notFound(shell)
        }
        // 봇이 아닌 직접 방문도 여기서 한 번 센다. 뒤이어 SPA 가 API 를 부르지만
        // 원장의 유니크 제약이 같은 방문자를 하루 1표로 접는다
        recordView.execute(RecordBlogViewUseCase.Command(detail.post.id, identity.visitorId, userAgent))
        return html(renderer.postPage(shell, detail))
    }

    @GetMapping("/authors/{handle}", produces = [MediaType.TEXT_HTML_VALUE])
    fun authorPage(@PathVariable handle: String): ResponseEntity<String> {
        val shell = shellProvider.shell()
        val space = try {
            getAuthorSpace.execute(GetBlogAuthorSpaceUseCase.Query(handle, page = 0, size = AUTHOR_PAGE_SIZE))
        } catch (e: BusinessException) {
            return notFound(shell)
        }
        return html(renderer.authorPage(shell, space))
    }

    private fun html(body: String): ResponseEntity<String> = ResponseEntity.ok()
        .contentType(MediaType.TEXT_HTML)
        // HTML 은 항상 재검증 — 발행 직후 CDN 이 옛 메타를 계속 내보내면 서버 렌더를 한 이유가 없다
        .header(HttpHeaders.CACHE_CONTROL, "no-cache, must-revalidate")
        .body(body)

    private fun notFound(shell: String?): ResponseEntity<String> = ResponseEntity.status(404)
        .contentType(MediaType.TEXT_HTML)
        .header(HttpHeaders.CACHE_CONTROL, "no-cache, must-revalidate")
        .body(renderer.notFoundPage(shell))

    private companion object {
        const val AUTHOR_PAGE_SIZE = 20
    }
}
