package com.kgd.payment.infrastructure.pg.toss

import com.kgd.payment.application.payment.port.PgCallException
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgPort
import com.kgd.payment.application.payment.port.PgResult
import io.github.oshai.kotlinlogging.KotlinLogging
import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * 토스페이먼츠 v1 REST.
 *
 * - 승인 확인 `POST /v1/payments/confirm` {paymentKey, orderId, amount} — `orderId` 에 우리 가맹점 주문번호(orderNo)를 쓴다
 * - 조회 `GET /v1/payments/orders/{orderId}`
 * - 취소 `POST /v1/payments/{paymentKey}/cancel` {cancelReason, cancelAmount?} + `Idempotency-Key`
 *
 * 토스 카드 결제는 승인 확인이 곧 **매입**이다 — 승인 확인·조회의 DONE 은 `captured = true` 로 답하고(결제는 AUTHORIZED 를
 * 거쳐 바로 CAPTURED), [capture] 는 PG 를 부르지 않는다. 그래서 VOID 도 토스에서는 전액 취소(cancel) 호출이다.
 * 카드번호·CVC 는 토스 결제창에서만 오가고 이 어댑터는 paymentKey 만 다룬다.
 */
class TossPgAdapter(
    private val restClient: RestClient,
    private val circuitBreaker: CircuitBreaker,
    private val objectMapper: ObjectMapper,
) : PgPort {
    private val log = KotlinLogging.logger {}

    /** 토스는 서버 단독 승인이 없다 — 결제창 인증 뒤 받은 paymentKey 로 [confirm] 만 한다 */
    override fun authorize(orderNo: String, amount: Long): PgResult = PgResult.Declined(PAYMENT_KEY_REQUIRED)

    override fun confirm(paymentKey: String, orderNo: String, amount: Long): PgResult = try {
        val body = call {
            restClient.post().uri("/v1/payments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("paymentKey" to paymentKey, "orderId" to orderNo, "amount" to amount))
                .retrieve().body(String::class.java)
        }
        val node = objectMapper.readTree(body)
        if (node.path("status").asString() == "DONE") {
            PgResult.Approved(node.path("paymentKey").asString(paymentKey), captured = true)
        } else {
            PgResult.Unknown("TOSS_STATUS:${node.path("status").asString()}")
        }
    } catch (e: HttpClientErrorException) {
        PgResult.Declined(errorCode(e))
    } catch (e: CallNotPermittedException) {
        // 서킷이 열려 요청을 보내지 않았다 — 승인이 생길 수 없다
        PgResult.Declined(CIRCUIT_OPEN)
    } catch (e: Exception) {
        log.warn(e) { "토스 승인 확인 결과 미상: orderNo=$orderNo" }
        PgResult.Unknown("TOSS_UNAVAILABLE:${e.javaClass.simpleName}")
    }

    override fun inquire(orderNo: String): PgInquiry = try {
        val body = call {
            restClient.get().uri("/v1/payments/orders/{orderId}", orderNo).retrieve().body(String::class.java)
        }
        toInquiry(objectMapper.readTree(body))
    } catch (e: HttpClientErrorException) {
        if (e.statusCode == HttpStatus.NOT_FOUND) PgInquiry.NotFound else PgInquiry.Unavailable(errorCode(e))
    } catch (e: Exception) {
        PgInquiry.Unavailable("TOSS_UNAVAILABLE:${e.javaClass.simpleName}")
    }

    /** 승인 확인에서 이미 매입됐다 — 호출할 API 가 없다 */
    override fun capture(paymentKey: String, amount: Long, capturedAt: Instant): Instant = capturedAt

    override fun void(paymentKey: String, amount: Long) =
        cancel(paymentKey, mapOf("cancelReason" to "VOID"), idempotencyKey = "void-$paymentKey")

    override fun refund(paymentKey: String, amount: Long, refundKey: String, reason: String?) =
        cancel(paymentKey, mapOf("cancelReason" to (reason ?: "REFUND"), "cancelAmount" to amount), refundKey)

    private fun cancel(paymentKey: String, body: Map<String, Any>, idempotencyKey: String) {
        try {
            call {
                restClient.post().uri("/v1/payments/{paymentKey}/cancel", paymentKey)
                    .header(IDEMPOTENCY_KEY, idempotencyKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().body(String::class.java)
            }
        } catch (e: HttpClientErrorException) {
            throw PgCallException("토스 취소 거절: ${errorCode(e)}", retryable = false, cause = e)
        } catch (e: Exception) {
            throw PgCallException("토스 취소 실패: ${e.javaClass.simpleName}", retryable = true, cause = e)
        }
    }

    private fun toInquiry(node: JsonNode): PgInquiry = when (val status = node.path("status").asString()) {
        // 부분 취소도 한 번은 승인된 거래다
        "DONE", "PARTIAL_CANCELED" -> PgInquiry.Approved(node.path("paymentKey").asString(), node.path("totalAmount").asLong(), captured = true)
        "CANCELED", "ABORTED", "EXPIRED" -> PgInquiry.Declined("TOSS_$status")
        else -> PgInquiry.Unavailable("TOSS_$status") // READY · IN_PROGRESS · WAITING_FOR_DEPOSIT
    }

    private fun errorCode(e: HttpClientErrorException): String =
        runCatching { objectMapper.readTree(e.responseBodyAsString).path("code").asString() }
            .getOrNull()?.takeIf { it.isNotBlank() } ?: "HTTP_${e.statusCode.value()}"

    private fun <T> call(block: () -> T): T = circuitBreaker.executeSupplier(block)

    private companion object {
        const val IDEMPOTENCY_KEY = "Idempotency-Key"
        const val PAYMENT_KEY_REQUIRED = "PAYMENT_KEY_REQUIRED"
        const val CIRCUIT_OPEN = "PG_CIRCUIT_OPEN"
    }
}
