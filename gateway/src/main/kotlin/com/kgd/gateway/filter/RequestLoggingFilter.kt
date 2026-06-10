package com.kgd.gateway.filter

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.time.Duration
import java.time.Instant

@Component
class RequestLoggingFilter : GlobalFilter, Ordered {

    private val log = KotlinLogging.logger {}

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val start = Instant.now()
        val request = exchange.request
        val method = request.method
        val uri = request.uri

        return chain.filter(exchange).doFinally {
            val duration = Duration.between(start, Instant.now()).toMillis()
            val statusCode = exchange.response.statusCode?.value() ?: 0
            log.info { "[$method] $uri → $statusCode (${duration}ms)" }
        }
    }
}
