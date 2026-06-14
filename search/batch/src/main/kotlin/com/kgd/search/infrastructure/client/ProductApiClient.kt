package com.kgd.search.infrastructure.client

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
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
    private val log = KotlinLogging.logger {}

    data class ProductDto(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val status: String,
        val stock: Int,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null,
        val createdAt: LocalDateTime
    )

    data class ProductPageResponse(
        val products: List<ProductDto>,
        val totalElements: Long,
        val totalPages: Int
    )

    /** 시드 적재 요청 1건 — product CreateProductRequest 와 동일 필드. */
    data class SeedProduct(
        val name: String,
        val price: BigDecimal,
        val stock: Int = 0,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null
    )

    /**
     * 대량 적재 — POST /api/products/bulk. 한 청크(N건)를 product 서비스가 한 트랜잭션으로
     * 저장하고 건별 product.item.created 이벤트를 발행한다. 생성된 건수를 반환.
     * 배치 스레드에서 동기 호출(block)한다.
     */
    fun createBulk(products: List<SeedProduct>): Int {
        if (products.isEmpty()) return 0
        val response = webClient.post()
            .uri("/api/products/bulk")
            .bodyValue(mapOf("products" to products))
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .block()
            ?: throw IllegalStateException("Empty response from product bulk API")

        @Suppress("UNCHECKED_CAST")
        val data = response["data"] as? Map<String, Any> ?: emptyMap()
        return (data["count"] as? Number)?.toInt() ?: products.size
    }

    suspend fun fetchPage(page: Int, size: Int = 100): ProductPageResponse {
        log.debug { "Fetching products: page=$page, size=$size" }

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
                brand = p["brand"] as? String,
                description = p["description"] as? String,
                category = p["category"] as? String,
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
