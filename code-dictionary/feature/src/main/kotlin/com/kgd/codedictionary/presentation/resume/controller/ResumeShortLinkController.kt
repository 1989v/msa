package com.kgd.codedictionary.presentation.resume.controller

import com.kgd.codedictionary.application.resume.usecase.RecordResumeShortLinkClickUseCase
import com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase
import com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase.Outcome
import com.kgd.common.crawler.CrawlerUserAgents
import com.kgd.common.shortlink.ShortLinkRedirects
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController

private val log = KotlinLogging.logger {}

/**
 * 이력서 단축 주소 `1989v.com/r/{code}` (ADR-0103).
 *
 * `/api` 밖 경로인 이유는 이 주소가 지원서·메신저로 공유되기 때문이다. 게이트웨이가 접두사를 떼지 않고 넘긴다.
 *
 * **로그에 코드·토큰·Location 을 남기지 않는다.** 코드와 토큰은 이력서 열람 권한 자체라, 로그를 볼 수 있는
 * 사람이 곧 열람할 수 있게 된다. 링크 id 만 남긴다.
 */
@RestController
class ResumeShortLinkController(
    private val resolveShortLink: ResolveResumeShortLinkUseCase,
    private val recordClick: RecordResumeShortLinkClickUseCase,
) {

    @GetMapping(PREFIX, "$PREFIX/**")
    fun open(
        request: HttpServletRequest,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ResponseEntity<Void> {
        // requestURI 에는 쿼리가 없다 — 쿼리는 무시하고 목적지에 넘기지 않는다.
        val path = request.requestURI.removePrefix(request.contextPath).removePrefix(PREFIX)
        val resolution = resolveShortLink.execute(path)
        log.debug { "단축 주소 /r 해석 — outcome=${resolution.outcome}, linkId=${resolution.shareLinkId}" }

        val linkId = resolution.shareLinkId
        // 미리보기 봇은 사람보다 먼저 주소를 연다. 세면 「공유 1번 = 클릭 1번」이 된다.
        if (resolution.outcome == Outcome.RESOLVED && linkId != null && !CrawlerUserAgents.isCrawler(userAgent)) {
            recordQuietly(linkId)
        }
        return ShortLinkRedirects.redirect(resolution.location)
    }

    /**
     * 클릭 적재가 302 를 막지 않는다 — 302 가 본질이고 통계는 부수다.
     * 적재 경로는 링크 id 만 다루므로 예외 메시지에도 코드·토큰이 실리지 않는다.
     */
    private fun recordQuietly(linkId: Long) {
        runCatching { recordClick.execute(linkId) }
            .onFailure { log.warn(it) { "단축 주소 클릭 적재 실패 — 리다이렉트는 계속한다. linkId=$linkId" } }
    }

    companion object {
        private const val PREFIX = "/r"
    }
}
