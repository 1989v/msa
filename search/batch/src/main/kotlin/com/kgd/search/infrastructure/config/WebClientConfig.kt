package com.kgd.search.infrastructure.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig {

    @Value("\${product.service.url:http://localhost:8081}")
    private lateinit var productServiceUrl: String

    @Value("\${place.service.url:http://localhost:8096}")
    private lateinit var placeServiceUrl: String

    @Bean("productWebClient")
    fun productWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(productServiceUrl).build()

    /**
     * place 응답에는 **벡터가 실려 온다**(ADR-0090). 한 페이지 100건이면 640차원 base64 가
     * 약 342KB 라 WebClient 기본 상한 256KB 를 넘겨 `DataBufferLimitException` 이 난다.
     *
     * 이 결함은 **벡터가 실제로 존재할 때만** 드러난다 — 첫 채움 전에는 lookup 이 빈 응답이라
     * 한도에 안 걸렸고, 채우자마자 재색인이 통째로 실패했다(2026-09-08).
     *
     * 8MiB 는 서버 상한(한 번에 500건)에 1024차원을 넣어도 남는 값이다(500 × 1024 × 4 → base64 약 2.7MiB).
     */
    @Bean("placeWebClient")
    fun placeWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(placeServiceUrl)
            .codecs { it.defaultCodecs().maxInMemorySize(LOOKUP_BUFFER_BYTES) }
            .build()

    companion object {
        /** 검사가 이 값을 그대로 본다 — 코드와 검사가 각자 사본을 갖지 않게. */
        const val LOOKUP_BUFFER_BYTES = 8 * 1024 * 1024
    }
}
