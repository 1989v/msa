package com.kgd.common.webclient

import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient

/**
 * WebClient 팩토리.
 * 외부 API 호출 시 사용할 WebClient를 생성하여 제공한다.
 * CircuitBreaker 적용은 호출부에서 circuitBreaker.executeSuspendFunction { ... } 패턴으로 직접 수행한다.
 */
class WebClientBuilderFactory(
    private val webClientBuilder: WebClient.Builder
) {
    fun create(baseUrl: String): WebClient =
        webClientBuilder.baseUrl(baseUrl).build()
}
