package com.kgd.common.webclient

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

/**
 * WebClient + CircuitBreaker 통합 팩토리.
 * 외부 API 호출 시 CircuitBreaker를 적용한 WebClient를 생성하여 제공한다.
 */
@Component
class WebClientBuilderFactory(
    private val webClientBuilder: WebClient.Builder,
    private val circuitBreakerRegistry: CircuitBreakerRegistry
) {
    private val log = LoggerFactory.getLogger(WebClientBuilderFactory::class.java)

    fun create(baseUrl: String): WebClient =
        webClientBuilder.baseUrl(baseUrl).build()

    fun <T : Any> withCircuitBreaker(
        circuitBreakerName: String,
        supplier: () -> Mono<T>,
        fallback: (Throwable) -> Mono<T>
    ): Mono<T> {
        circuitBreakerRegistry.circuitBreaker(circuitBreakerName)
        return Mono.defer<T> { supplier() }
            .onErrorResume { ex ->
                log.warn("CircuitBreaker [$circuitBreakerName] activated: ${ex.message}")
                fallback(ex)
            }
    }
}
