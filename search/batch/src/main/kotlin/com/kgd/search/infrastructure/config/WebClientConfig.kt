package com.kgd.search.infrastructure.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.JdkClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import java.net.http.HttpClient
import java.time.Duration

@Configuration
class WebClientConfig {

    @Value("\${product.service.url:http://localhost:8081}")
    private lateinit var productServiceUrl: String

    @Value("\${place.service.url:http://localhost:8096}")
    private lateinit var placeServiceUrl: String

    @Value("\${atlas.service.url:http://localhost:8089}")
    private lateinit var atlasServiceUrl: String

    @Value("\${wishlist.service.url:http://localhost:8093}")
    private lateinit var wishlistServiceUrl: String

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
     *
     * 연결 제한 시간을 둔다 — 응답 제한 시간은 호출마다 [com.kgd.search.infrastructure.client.PlaceApiClient] 가 건다.
     * 이 모듈에는 reactor-netty 가 없어 기본 커넥터도 JDK HttpClient 다. 같은 커넥터에 연결 제한만 더한다.
     */
    @Bean("placeWebClient")
    fun placeWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(placeServiceUrl)
            .clientConnector(JdkClientHttpConnector(HttpClient.newBuilder().connectTimeout(PLACE_CONNECT_TIMEOUT).build()))
            .codecs { it.defaultCodecs().maxInMemorySize(LOOKUP_BUFFER_BYTES) }
            .build()

    /** atlas(개념 사전 · 전시 서비스) — 통합 인덱스 원천. 응답이 작아 기본 버퍼면 된다 */
    @Bean("atlasWebClient")
    fun atlasWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(atlasServiceUrl).build()

    /** wishlist(account 파드) 내부 집계 — 관광지 재색인이 찜 수를 회차당 한 번 받는다. 응답이 작아 기본 버퍼면 된다 */
    @Bean("wishlistWebClient")
    fun wishlistWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(wishlistServiceUrl)
            .clientConnector(JdkClientHttpConnector(HttpClient.newBuilder().connectTimeout(PLACE_CONNECT_TIMEOUT).build()))
            .build()

    companion object {
        /** 검사가 이 값을 그대로 본다 — 코드와 검사가 각자 사본을 갖지 않게. */
        const val LOOKUP_BUFFER_BYTES = 8 * 1024 * 1024

        private val PLACE_CONNECT_TIMEOUT: Duration = Duration.ofSeconds(5)
    }
}
