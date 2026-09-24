package com.kgd.order.infrastructure.config

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.JdkClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import java.net.http.HttpClient
import java.time.Duration

@Configuration
class WebClientConfig {

    @Value("\${payment.service.url:http://localhost:9090}")
    private lateinit var paymentServiceUrl: String

    @Value("\${product.service.url:http://localhost:8081}")
    private lateinit var productServiceUrl: String

    @Bean("paymentWebClient")
    fun paymentWebClient(): WebClient = WebClient.builder()
        .baseUrl(paymentServiceUrl)
        .clientConnector(boundedConnector())
        .build()

    @Bean("productWebClient")
    fun productWebClient(): WebClient = WebClient.builder()
        .baseUrl(productServiceUrl)
        .clientConnector(boundedConnector())
        .build()

    /**
     * 연결 3초 · 읽기 5초 (ADR-0015). 기본 커넥터는 제한이 없어 상대가 멈추면 주문 요청 스레드가 같이 멈춘다.
     * JDK HttpClient 로 둔다 — 이 모듈 런타임에 reactor-netty 가 없어 기본값도 이것이다.
     */
    private fun boundedConnector() = JdkClientHttpConnector(
        HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build(),
    ).apply { setReadTimeout(READ_TIMEOUT) }

    private companion object {
        val CONNECT_TIMEOUT: Duration = Duration.ofSeconds(3)
        val READ_TIMEOUT: Duration = Duration.ofSeconds(5)
    }

    @Bean
    fun circuitBreakerRegistry(): CircuitBreakerRegistry {
        val config = CircuitBreakerConfig.custom()
            .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(10)
            .failureRateThreshold(50f)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(3)
            .build()
        return CircuitBreakerRegistry.of(config)
    }
}
