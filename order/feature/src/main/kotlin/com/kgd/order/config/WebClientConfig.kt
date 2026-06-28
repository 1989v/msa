package com.kgd.order.infrastructure.config

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient
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
        .build()

    @Bean("productWebClient")
    fun productWebClient(): WebClient = WebClient.builder()
        .baseUrl(productServiceUrl)
        .build()

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
