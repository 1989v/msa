package com.kgd.quant.infrastructure.notification

import com.kgd.quant.application.audit.AuditEvent
import com.kgd.quant.application.audit.AuditLogPublisher
import com.kgd.quant.application.port.notification.NotificationEvent
import com.kgd.quant.application.port.notification.NotificationPriority
import com.kgd.quant.application.port.notification.NotificationSender
import com.kgd.quant.application.port.notification.SendResult
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.delay
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import java.util.UUID

private val log = KotlinLogging.logger {}

/**
 * TG-P2-10 — Telegram Bot HTTP API 기반 [NotificationSender] 구현 (Phase 1 stub 대체).
 *
 * ## 발송 흐름
 * 1. bot token 또는 chatId 미설정 시 즉시 [SendResult.Failure]("not_configured", retryable=false) 반환 (warn 로그).
 * 2. [PerChatRateLimiter.acquire] 로 1 msg/s/chat 강제 (Phase 2 in-memory).
 * 3. WebClient `POST {apiBase}/bot{token}/sendMessage` JSON `{chat_id, text, parse_mode}`.
 * 4. 응답 분기:
 *    - 2xx → [SendResult.Success] + latency 메트릭
 *    - 4xx → 즉시 실패 (`client_error_<code>`, retryable=false)
 *    - 5xx 또는 IO 예외 → exp backoff 1s/2s/4s 로 최대 [MAX_ATTEMPTS] 회 재시도, 최종 실패 시 audit + 메트릭
 *
 * ## 보안 (INV-P2-12)
 * - bot token 은 절대 로그/메트릭 태그에 노출하지 않는다. 예외 메시지 출력 시 [maskToken] 적용.
 * - URI 빌드는 WebClient `uriVariables` 를 통해 처리한다. 외부 IO 예외 메시지에 token 이 섞일 가능성을
 *   대비해 모든 외부 메시지 출력은 [maskToken] 통과 후 기록한다.
 *
 * ## Phase 2 단순화
 * - [defaultChatId] 단일 chat 가정. 추후 `NotificationTarget` repository 조회로 확장 (TG-P2-12 후속).
 * - bot token 은 환경 변수에서 직접 주입. KMS unwrap 통합은 후속 (현재 Spring `@Value`).
 * - audit 발행은 best-effort — `AuditLogPublisher` 빈이 활성화되지 않은 환경(Phase 2 default)에서는 skip.
 *
 * ## ADR / 컨벤션 준수
 * - ADR-0002: WebClient(WebFlux) + Coroutines (`awaitSingleOrNull`) 사용.
 * - ADR-0020: `@Transactional` 미부착 — 외부 IO 합성.
 * - ADR-0021: kotlin-logging 람다 형식 + token 평문 미노출.
 */
@Component
class TelegramBotNotificationSender(
    @Value("\${quant.notification.telegram.api-base:https://api.telegram.org}")
    private val apiBase: String,
    @Value("\${quant.notification.telegram.bot-token:}")
    private val botToken: String,
    @Value("\${quant.notification.telegram.default-chat-id:}")
    private val defaultChatId: String,
    private val rateLimiter: PerChatRateLimiter,
    private val webClientBuilder: WebClient.Builder,
    private val metrics: QuantMetrics,
    private val auditPublisherProvider: ObjectProvider<AuditLogPublisher>,
) : NotificationSender {

    private val webClient: WebClient by lazy { webClientBuilder.baseUrl(apiBase).build() }

    override suspend fun send(tenantId: TenantId, event: NotificationEvent): SendResult {
        if (botToken.isBlank() || defaultChatId.isBlank()) {
            log.warn {
                "Telegram bot token or chatId not configured — skipping notification " +
                    "tenantId=${tenantId.value} eventType=${event::class.simpleName}"
            }
            metrics.notificationSendFailure(CHANNEL, REASON_NOT_CONFIGURED)
            return SendResult.Failure(REASON_NOT_CONFIGURED, retryable = false)
        }

        val chatId = defaultChatId
        val priority = priorityFor(event)
        rateLimiter.acquire(chatId)

        val text = formatMessage(event)
        val notificationId = UUID.randomUUID()

        var lastFailure: Throwable? = null
        repeat(MAX_ATTEMPTS) { attempt ->
            try {
                val startNanos = System.nanoTime()
                webClient.post()
                    .uri("/bot{token}/sendMessage", botToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(
                        mapOf(
                            "chat_id" to chatId,
                            "text" to text,
                            "parse_mode" to "Markdown",
                        )
                    )
                    .retrieve()
                    .toBodilessEntity()
                    .awaitSingleOrNull()
                val latencyMs = (System.nanoTime() - startNanos) / 1_000_000L
                metrics.notificationSendLatency(CHANNEL, priority.name, latencyMs)
                log.info {
                    "telegram notification sent notificationId=$notificationId tenantId=${tenantId.value} " +
                        "priority=${priority.name} latencyMs=$latencyMs attempt=${attempt + 1}"
                }
                return SendResult.Success
            } catch (e: WebClientResponseException) {
                lastFailure = e
                val status = e.statusCode
                if (status.is5xxServerError) {
                    val backoffMs = backoffMs(attempt)
                    log.warn {
                        "telegram 5xx — retrying notificationId=$notificationId attempt=${attempt + 1}/$MAX_ATTEMPTS " +
                            "status=${status.value()} backoffMs=$backoffMs"
                    }
                    if (attempt < MAX_ATTEMPTS - 1) delay(backoffMs)
                } else {
                    // 4xx — 즉시 실패. token / chatId / payload 문제로 재시도 무의미.
                    val reason = "${REASON_CLIENT_ERROR_PREFIX}${status.value()}"
                    log.warn {
                        "telegram 4xx — abort notificationId=$notificationId status=${status.value()} " +
                            "message=${maskToken(e.message)}"
                    }
                    metrics.notificationSendFailure(CHANNEL, reason)
                    return SendResult.Failure(reason, retryable = false)
                }
            } catch (e: Exception) {
                lastFailure = e
                val backoffMs = backoffMs(attempt)
                log.warn {
                    "telegram io error — retrying notificationId=$notificationId attempt=${attempt + 1}/$MAX_ATTEMPTS " +
                        "message=${maskToken(e.message)} backoffMs=$backoffMs"
                }
                if (attempt < MAX_ATTEMPTS - 1) delay(backoffMs)
            }
        }

        // 최종 실패
        metrics.notificationSendFailure(CHANNEL, REASON_MAX_RETRIES_EXCEEDED)
        log.error {
            "telegram send failed after $MAX_ATTEMPTS attempts notificationId=$notificationId " +
                "tenantId=${tenantId.value} reason=${maskToken(lastFailure?.message)}"
        }
        publishAuditBestEffort(tenantId = tenantId, notificationId = notificationId, lastFailure = lastFailure)
        return SendResult.Failure(REASON_MAX_RETRIES_EXCEEDED, retryable = true)
    }

    /**
     * audit_log 에 best-effort 발행. AuditLogPublisher 빈이 비활성화된 환경에서는 no-op.
     * 발행 자체가 실패해도 send 결과에는 영향을 주지 않는다.
     */
    private suspend fun publishAuditBestEffort(
        tenantId: TenantId,
        notificationId: UUID,
        lastFailure: Throwable?,
    ) {
        val publisher = auditPublisherProvider.ifAvailable ?: return
        try {
            val errorMessage = maskToken(lastFailure?.message) ?: "unknown"
            val payloadJson = """{"error":"${jsonEscape(errorMessage)}"}"""
            publisher.publish(
                AuditEvent(
                    tenantId = tenantId.value,
                    actor = "system",
                    action = ACTION_TELEGRAM_SEND_FAILED,
                    target = notificationId.toString(),
                    payloadJson = payloadJson,
                )
            )
        } catch (ex: Exception) {
            log.warn(ex) { "audit publish best-effort failed (notificationId=$notificationId)" }
        }
    }

    private fun formatMessage(event: NotificationEvent): String = when (event) {
        is NotificationEvent.OrderFilled ->
            "*FILL* ${event.symbol} ${event.side} price=${event.price} qty=${event.quantity}"

        is NotificationEvent.RiskLimitBreached ->
            "*RISK* ${event.limitType}=${event.value}"

        is NotificationEvent.EmergencyLiquidation ->
            "*EMERGENCY LIQUIDATION* reason=${event.reason}"

        is NotificationEvent.StrategyLifecycle ->
            "*STRATEGY* ${event.strategyId} -> ${event.transition}"
    }

    private fun priorityFor(event: NotificationEvent): NotificationPriority = when (event) {
        is NotificationEvent.EmergencyLiquidation -> NotificationPriority.CRITICAL
        is NotificationEvent.RiskLimitBreached -> NotificationPriority.RISK
        is NotificationEvent.OrderFilled,
        is NotificationEvent.StrategyLifecycle -> NotificationPriority.INFO
    }

    private fun backoffMs(attempt: Int): Long {
        // 1s, 2s, 4s, ... (attempt 0-based). attempt < 30 가정으로 overflow 무시.
        return BASE_BACKOFF_MS shl attempt
    }

    /**
     * 예외 메시지 등에 bot token 평문이 섞였을 가능성을 방어적으로 마스킹.
     * URI placeholder substitution 으로 인해 WebClient 예외 메시지에 token 이 노출될 수 있다.
     */
    private fun maskToken(input: String?): String? {
        if (input.isNullOrBlank() || botToken.isBlank()) return input
        return input.replace(botToken, "****")
    }

    private fun jsonEscape(input: String): String =
        input.replace("\\", "\\\\").replace("\"", "\\\"")

    companion object {
        const val CHANNEL: String = "telegram"
        const val MAX_ATTEMPTS: Int = 3
        const val BASE_BACKOFF_MS: Long = 1_000L

        const val REASON_NOT_CONFIGURED: String = "not_configured"
        const val REASON_MAX_RETRIES_EXCEEDED: String = "max_retries_exceeded"
        const val REASON_CLIENT_ERROR_PREFIX: String = "client_error_"

        const val ACTION_TELEGRAM_SEND_FAILED: String = "TELEGRAM_SEND_FAILED"
    }
}
