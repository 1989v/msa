package com.kgd.order.infrastructure.client

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.application.order.port.ProductInfo
import com.kgd.order.application.order.port.ProductPort
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction
import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import java.math.BigDecimal

@Component
class ProductAdapter(
    @Qualifier("productWebClient") private val webClient: WebClient,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
) : ProductPort {

    private val log = LoggerFactory.getLogger(javaClass)
    private val circuitBreaker = circuitBreakerRegistry.circuitBreaker("product-service")

    override suspend fun validateProduct(productId: Long): ProductInfo {
        return circuitBreaker.executeSuspendFunction {
            try {
                val response = webClient.get()
                    .uri("/api/products/{id}", productId)
                    .retrieve()
                    .bodyToMono(ProductApiResponse::class.java)
                    .awaitSingle()

                response?.data?.toProductInfo()
                    ?: throw BusinessException(ErrorCode.NOT_FOUND, "상품을 찾을 수 없습니다: productId=$productId")
            } catch (e: WebClientResponseException.NotFound) {
                throw BusinessException(ErrorCode.NOT_FOUND, "상품을 찾을 수 없습니다: productId=$productId")
            } catch (e: BusinessException) {
                throw e
            } catch (e: Exception) {
                log.error("상품 서비스 호출 실패: productId={}", productId, e)
                throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "상품 서비스 호출 실패: ${e.message}")
            }
        }
    }
}

/**
 * Product API 응답 wrapper (ApiResponse<ProductResponse> 패턴)
 */
private data class ProductApiResponse(
    val success: Boolean = false,
    val data: ProductData? = null,
    val error: Any? = null,
)

private data class ProductData(
    val id: Long = 0,
    val name: String = "",
    val price: BigDecimal = BigDecimal.ZERO,
    val stock: Int = 0,
    val status: String = "",
) {
    fun toProductInfo(): ProductInfo = ProductInfo(
        productId = id,
        name = name,
        price = price,
        status = status,
        stock = stock,
    )
}
