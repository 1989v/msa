package com.kgd.deal.presentation.controller

import com.kgd.deal.application.service.DealRedirectService
import com.kgd.deal.application.service.RedirectDecision
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.net.URI

private val log = KotlinLogging.logger {}

/**
 * 아웃바운드 리다이렉터 (ADR-0069 §3).
 *
 * `/api/v1/deal/go/...` 가 아니라 `/go/...` 인 이유는 이 주소가 공유되기 때문이다.
 * ingress 는 deal 호스트에만 이 prefix 를 연다.
 */
@RestController
class DealRedirectController(
    private val redirectService: DealRedirectService,
) {

    @GetMapping("/go/{slug}")
    fun go(
        @PathVariable slug: String,
        @RequestHeader(value = HttpHeaders.REFERER, required = false) referer: String?,
        @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ResponseEntity<Void> = when (val decision = redirectService.resolve(slug)) {
        is RedirectDecision.Go -> {
            recordQuietly(decision.offerId, slug, referer, userAgent)
            // target_url 은 원본 그대로. 파라미터를 재조립하면 네트워크 약관 위반이고
            // 트래킹 쿠키가 깨져 수익 자체가 사라진다.
            redirect(decision.targetUrl)
        }

        is RedirectDecision.Unavailable ->
            // 프로모션은 끝나도 공유된 링크는 남는다. 404 로 끊지 않고 같은 분류의 목록으로 보낸다.
            redirect("/?category=${decision.categoryCode}")

        RedirectDecision.NotFound -> ResponseEntity.notFound().build()
    }

    /**
     * 통계 적재가 리다이렉트를 막지 않는다. 이 순서를 뒤집으면 DB 가 흔들릴 때
     * 수익 링크가 통째로 죽는다 — 클릭 수는 다시 셀 수 있지만 놓친 방문은 못 되돌린다.
     */
    private fun recordQuietly(offerId: Long, slug: String, referer: String?, userAgent: String?) {
        runCatching { redirectService.recordClick(offerId, referer, userAgent) }
            .onFailure { log.warn(it) { "클릭 적재 실패 — 리다이렉트는 계속한다. slug=$slug" } }
    }

    private fun redirect(location: String): ResponseEntity<Void> =
        ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(location))
            // 302 가 캐시되면 링크를 교체해도 옛 대상으로 계속 나간다.
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            // robots.txt 의 `Disallow: /go/` 를 무시하는 수집기가 있다. 공유되는 주소라
            // 외부에서 발견되기도 쉬운데, 색인되면 제휴 트래킹 URL 이 검색결과에 노출되고
            // 302 를 따라간 링크 신호가 제휴사로 넘어간다 (ADR-0069 §3, ADR-0062).
            .header("X-Robots-Tag", "noindex, nofollow")
            .build()
}
