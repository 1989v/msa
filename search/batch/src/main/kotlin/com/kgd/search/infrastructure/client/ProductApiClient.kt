package com.kgd.search.infrastructure.client

import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal
import java.time.LocalDateTime

@Component
class ProductApiClient(
    @Qualifier("productWebClient") private val webClient: WebClient
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class ProductDto(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val status: String,
        val stock: Int,
        val createdAt: LocalDateTime
    )

    data class ProductPageResponse(
        val products: List<ProductDto>,
        val totalElements: Long,
        val totalPages: Int
    )

    suspend fun fetchPage(page: Int, size: Int = 100): ProductPageResponse {
        log.debug("Fetching products: page={}, size={}", page, size)

        val response = webClient.get()
            .uri("/api/products?page=$page&size=$size")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitSingle()

        @Suppress("UNCHECKED_CAST")
        val data = response["data"] as? Map<String, Any>
            ?: throw IllegalStateException("No data field in product API response")

        @Suppress("UNCHECKED_CAST")
        val products = (data["products"] as? List<Map<String, Any>> ?: emptyList()).map { p ->
            ProductDto(
                id = (p["id"] as Number).toLong(),
                name = p["name"] as String,
                price = BigDecimal(p["price"].toString()),
                status = p["status"] as String,
                stock = (p["stock"] as? Number)?.toInt() ?: 0,
                createdAt = p["createdAt"]?.toString()?.let { LocalDateTime.parse(it) }
                    ?: LocalDateTime.now()
            )
        }

        return ProductPageResponse(
            products = products,
            totalElements = (data["totalElements"] as Number).toLong(),
            totalPages = (data["totalPages"] as Number).toInt()
        )
    }
}
