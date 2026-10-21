package com.kgd.gateway.filter

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.slf4j.LoggerFactory
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import reactor.core.publisher.Mono

class CafeNearbyLoggingTest : BehaviorSpec({
    Given("a nearby request with a coordinate canary") {
        Then("gateway only logs the fixed path and applies no-store") {
            val logger = LoggerFactory.getLogger(RequestLoggingFilter::class.java) as Logger
            val appender = ListAppender<ILoggingEvent>().also { it.start(); logger.addAppender(it) }
            try {
                val exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/api/v1/ranking/cafe/nearby-search?ignored=37.51234567").body("{\"lat\":37.51234567}"))
                RequestLoggingFilter().filter(exchange, GatewayFilterChain { Mono.empty() }).block()
                exchange.response.headers.cacheControl shouldBe "no-store"
                appender.list.any { it.formattedMessage.contains("nearby-search") } shouldBe true
                appender.list.any { it.formattedMessage.contains("37.51234567") } shouldBe false
            } finally { logger.detachAppender(appender); appender.stop() }
        }
    }
})
