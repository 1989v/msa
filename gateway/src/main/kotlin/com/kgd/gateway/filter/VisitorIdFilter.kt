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
            mutatedExchange.response.addCookie(
                ResponseCookie.from(VISITOR_COOKIE, visitorId)
                    .path("/")
                    .maxAge(Duration.ofDays(365))
                    .httpOnly(true)
                    .build()
            )
        }

        return chain.filter(mutatedExchange)
    }
}
