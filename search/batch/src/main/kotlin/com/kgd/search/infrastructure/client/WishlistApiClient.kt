package com.kgd.search.infrastructure.client

import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.time.Duration

/**
 * wishlist(account 파드) 내부 집계 — 관광지 재색인이 회차당 한 번 부른다. 실패는 호출부가 처리한다(찜 없이 색인을 이어 간다).
 */
@Component
class WishlistApiClient(
    @Qualifier("wishlistWebClient") private val webClient: WebClient,
    @Value("\${wishlist.service.response-timeout:30s}") private val responseTimeout: Duration = Duration.ofSeconds(30),
) {
    /** @return 대상 키(관광지 언어 문서 id) → 찜한 회원 수. [min] 명 이상만 온다. */
    suspend fun fetchTargetCounts(type: String, min: Int): Map<String, Int> {
        val response = webClient.get()
            .uri { it.path("/internal/wishlist/target-counts").queryParam("type", type).queryParam("min", min).build() }
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any?>>() {})
            .timeout(responseTimeout)
            .awaitSingle()

        @Suppress("UNCHECKED_CAST")
        val items = response["data"] as? List<Map<String, Any?>>
            ?: throw IllegalStateException("찜 집계 응답에 data 목록이 없다")
        return items.associate { (it["targetKey"] as String) to (it["count"] as Number).toInt() }
    }
}
