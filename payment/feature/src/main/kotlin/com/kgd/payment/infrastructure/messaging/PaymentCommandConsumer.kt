package com.kgd.payment.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.infrastructure.config.PaymentKafkaConfig
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * 사가 명령 `payment.command.{authorize,capture,void,refund}` (키 = orderId).
 *
 * 멱등은 두 겹이다: `processed_event` 원장(같은 이벤트 id 재배달) + 유스케이스 자체의 자연 멱등
 * (orderNo 로 결제 행이 있으면 PG 를 다시 부르지 않음 · refundKey 중복 거름). 원장 마킹은 처리 뒤 별도
 * 트랜잭션이라(ADR-0029 Policy A) 둘째 겹이 없으면 마킹 직전 장애에서 PG 가 두 번 불린다.
 */
@Component
class PaymentCommandConsumer(
    private val commands: ProcessPaymentCommandUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("paymentIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(topics = [AUTHORIZE], groupId = GROUP, containerFactory = FACTORY)
    fun onAuthorize(record: ConsumerRecord<String, String>) = handle(record) { c ->
        commands.authorize(ProcessPaymentCommandUseCase.Authorize(c.orderId, c.orderNo, requireNotNull(c.amount) { "amount 가 없다" }, c.paymentKey))
    }

    @KafkaListener(topics = [CAPTURE], groupId = GROUP, containerFactory = FACTORY)
    fun onCapture(record: ConsumerRecord<String, String>) = handle(record) { c -> commands.capture(c.orderNo) }

    @KafkaListener(topics = [VOID], groupId = GROUP, containerFactory = FACTORY)
    fun onVoid(record: ConsumerRecord<String, String>) = handle(record) { c -> commands.void(c.orderNo) }

    @KafkaListener(topics = [REFUND], groupId = GROUP, containerFactory = FACTORY)
    fun onRefund(record: ConsumerRecord<String, String>) = handle(record) { c ->
        commands.refund(
            ProcessPaymentCommandUseCase.Refund(
                orderNo = c.orderNo,
                amount = requireNotNull(c.amount) { "amount 가 없다" },
                refundKey = requireNotNull(c.refundKey) { "refundKey 가 없다 — 환불 멱등 키는 필수" },
                reason = c.reason,
            ),
        )
    }

    private fun handle(record: ConsumerRecord<String, String>, block: (PaymentCommandMessage) -> Unit) {
        val command = objectMapper.readValue(record.value(), PaymentCommandMessage::class.java)
        log.info { "Received ${record.topic()}: orderId=${command.orderId}, orderNo=${command.orderNo}" }
        val eventId = command.eventId?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            log.warn { "missing eventId topic=${record.topic()} — 유스케이스 자연 멱등에 기대 처리한다" }
            idempotentMetrics.missingId(GROUP)
            block(command)
            return
        }
        idempotent.process(eventId, GROUP) { block(command) }
    }

    companion object {
        const val AUTHORIZE = "payment.command.authorize"
        const val CAPTURE = "payment.command.capture"
        const val VOID = "payment.command.void"
        const val REFUND = "payment.command.refund"
        private const val GROUP = PaymentKafkaConfig.CONSUMER_GROUP
        private const val FACTORY = "paymentKafkaListenerContainerFactory"
    }
}

/** `payment.command.*` 페이로드. 카드 정보 필드는 없다 — 토스 흐름에서도 paymentKey 까지만 온다 */
data class PaymentCommandMessage(
    val eventId: String? = null,
    val orderId: Long,
    val orderNo: String,
    val amount: Long? = null,
    val paymentKey: String? = null,
    val refundKey: String? = null,
    val reason: String? = null,
)
