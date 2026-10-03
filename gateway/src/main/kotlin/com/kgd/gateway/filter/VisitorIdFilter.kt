package com.kgd.gateway.filter

import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.time.Duration
import java.util.UUID

@Component
class VisitorIdFilter : GlobalFilter, Ordered {

    companion object {
        const val VISITOR_COOKIE = "vid"
        const val VISITOR_HEADER = "X-Visitor-Id"

        /** `public` 지시가 있으면 엣지가 여러 사람에게 같은 응답을 내준다 — 그 응답에 개인 쿠키를 싣지 않는다 */
        internal fun isPublicCache(cacheControl: String?): Boolean =
            cacheControl?.split(',')?.any { it.trim().equals("public", ignoreCase = true) } == true
    }

    override fun getOrder(): Int = -10 // Run before auth filter

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val existingCookie = exchange.request.cookies[VISITOR_COOKIE]?.firstOrNull()?.value
        val visitorId = existingCookie ?: UUID.randomUUID().toString()

        val mutatedRequest = exchange.request.mutate()
            .header(VISITOR_HEADER, visitorId)
            .build()

        val mutatedExchange = exchange.mutate().request(mutatedRequest).build()

        if (existingCookie == null) {
            // 쿠키는 응답 헤더가 정해진 뒤에 심는다 — 공개 캐시 응답(`Cache-Control: public`)에 사용자별 쿠키가 붙으면
            // Cloudflare 가 캐시하지 않는다(BYPASS, ADR-0105). 그런 응답은 건너뛰고 다음 비공개 응답에서 심는다.
            val response = mutatedExchange.response
            response.beforeCommit {
                if (!isPublicCache(response.headers.cacheControl)) {
                    response.addCookie(
                        ResponseCookie.from(VISITOR_COOKIE, visitorId)
                            .path("/")
                            .maxAge(Duration.ofDays(365))
                            .httpOnly(true)
                            .build()
                    )
                }
                Mono.empty()
            }
        }

        return chain.filter(mutatedExchange)
    }
}
