package com.kgd.blog.presentation.controller

import com.kgd.blog.application.shortlink.usecase.RecordBlogShortLinkClickUseCase
import com.kgd.blog.application.shortlink.usecase.ResolveBlogShortLinkUseCase
import com.kgd.blog.application.shortlink.usecase.ResolveBlogShortLinkUseCase.Outcome
import com.kgd.common.shortlink.ShortLinkRedirects
import com.kgd.common.web.CrawlerUserAgents
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController

private val log = KotlinLogging.logger {}

/**
 * 블로그 글 단축 주소 `1989v.com/b/{code}` (ADR-0106).
 *
 * `/api` 밖 경로인 이유는 이 주소가 메신저로 공유되기 때문이다. 게이트웨이가 접두사를 떼지 않고 넘긴다.
 */
@RestController
class BlogShortLinkController(
    private val resolveShortLink: ResolveBlogShortLinkUseCase,
    private val recordClick: RecordBlogShortLinkClickUseCase,
) {

    @GetMapping(PREFIX, "$PREFIX/**")
    fun open(
        request: HttpServletRequest,
        @RequestHeader(value = HttpHeaders.REFERER, required = false) referer: String?,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ResponseEntity<Void> {
        // requestURI 에는 쿼리가 없다 — 쿼리는 무시하고 목적지에 넘기지 않는다.
        val path = request.requestURI.removePrefix(request.contextPath).removePrefix(PREFIX)
        val resolution = resolveShortLink.execute(path)
        log.debug { "단축 주소 /b 해석 — outcome=${resolution.outcome}, postId=${resolution.postId}" }

        val postId = resolution.postId
        // 미리보기 봇은 사람보다 먼저 주소를 연다. 세면 「공유 1번 = 클릭 1번」이 된다.
        if (resolution.outcome == Outcome.RESOLVED && postId != null && !CrawlerUserAgents.isCrawler(userAgent)) {
            recordQuietly(postId, referer, userAgent)
        }
        return ShortLinkRedirects.redirect(resolution.location)
    }

    /** 클릭 적재가 302 를 막지 않는다 — 302 가 본질이고 통계는 부수다. */
    private fun recordQuietly(postId: Long, referer: String?, userAgent: String?) {
        runCatching { recordClick.execute(RecordBlogShortLinkClickUseCase.Command(postId, referer, userAgent)) }
            .onFailure { log.warn(it) { "단축 주소 클릭 적재 실패 — 리다이렉트는 계속한다. postId=$postId" } }
    }

    companion object {
        private const val PREFIX = "/b"
    }
}
