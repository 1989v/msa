package com.kgd.common.webclient

import org.springframework.web.reactive.function.client.WebClient

/**
 * 공통 정책이 적용된 WebClient.Builder를 복제하여 서비스별 client를 생성하는 팩토리.
 * 원본 builder를 mutate하지 않으므로 호출 간 상태 오염이 없다.
 */
class WebClientBuilderFactory(
    private val webClientBuilder: WebClient.Builder
) {
    fun create(baseUrl: String): WebClient =
        webClientBuilder.clone()
            .baseUrl(baseUrl)
            .build()

    fun builder(baseUrl: String? = null): WebClient.Builder {
        val cloned = webClientBuilder.clone()
        if (baseUrl != null) {
            cloned.baseUrl(baseUrl)
        }
        return cloned
    }
}
