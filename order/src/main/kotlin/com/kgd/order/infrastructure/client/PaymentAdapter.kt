package com.kgd.order.infrastructure.client

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.application.order.port.PaymentPort
import com.kgd.order.application.order.port.PaymentResult
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction
import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal

@Component
class PaymentAdapter(
    private val webClient: WebClient,
    private val circuitBreakerRegistry: CircuitBreakerRegistry
) : PaymentPort {

    private val log = LoggerFactory.getLogger(javaClass)
    private val circuitBreaker = circuitBreakerRegistry.circuitBreaker("payment-service")

    override suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult {
        return circuitBreaker.executeSuspendFunction {
            webClient.post()
                .uri("/payments")
                .bodyValue(mapOf("orderId" to orderId, "amount" to amount))
                .retrieve()
                .bodyToMono(PaymentResult::class.java)
                .awaitSingle()
                ?: throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "결제 서비스 응답이 없습니다")
        }
    }
}
