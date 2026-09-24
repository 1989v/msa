package com.kgd.payment.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.payment.application.payment.port.PaymentEventPort
import com.kgd.payment.application.payment.port.PaymentEventType
import com.kgd.payment.application.payment.port.PgSettlementLine
import com.kgd.payment.domain.payment.model.Payment
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.time.LocalDate

/**
 * 결제 이벤트를 payment_db 아웃박스 행으로 남긴다. 토픽 = `payment.payment.*` · `payment.reconciliation.settled`,
 * Kafka 키 = orderId — 사가가 주고받는 명령·이벤트는 한 주문이 한 파티션에 줄 선다.
 * 카드 정보는 이 도메인 어디에도 없다 — 페이로드에도 PG 거래 키까지만 싣는다.
 */
@Component
class PaymentOutboxEventAdapter(
    @Qualifier("paymentOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : PaymentEventPort {

    override fun publish(type: PaymentEventType, payment: Payment, reason: String?, refundAmount: Long?) {
        val payload = PaymentEventPayload(
            paymentId = requireNotNull(payment.id),
            orderId = payment.orderId,
            orderNo = payment.orderNo,
            amount = payment.amount,
            paymentKey = payment.paymentKey,
            status = payment.status.name,
            reason = reason,
            refundAmount = refundAmount,
            refundedAmount = payment.refundedAmount,
            occurredAt = payment.updatedAt,
        )
        save(payment, topicOf(type), objectMapper.writeValueAsString(payload))
    }

    override fun publishSettled(payment: Payment, settleDate: LocalDate, line: PgSettlementLine) {
        val payload = SettledPayload(
            date = settleDate.toString(),
            orderId = payment.orderId,
            orderNo = line.orderNo,
            paymentKey = line.paymentKey,
            grossAmount = line.grossAmount,
            pgFee = line.pgFee,
            depositAmount = line.depositAmount,
        )
        save(payment, SETTLED_TOPIC, objectMapper.writeValueAsString(payload))
    }

    private fun save(payment: Payment, topic: String, payload: String) {
        outbox.save(
            aggregateType = AGGREGATE_TYPE,
            aggregateId = requireNotNull(payment.id),
            eventType = topic,
            payload = payload,
            partitionKey = payment.orderId.toString(),
            headers = emptyMap(),
        )
    }

    companion object {
        const val AGGREGATE_TYPE = "payment"
        const val SETTLED_TOPIC = "payment.reconciliation.settled"

        fun topicOf(type: PaymentEventType): String = "payment.payment.${type.name.lowercase()}"
    }
}

/** `payment.payment.*` 페이로드 — 저장 포맷은 infrastructure 가 소유한다 */
data class PaymentEventPayload(
    val paymentId: Long,
    val orderId: Long,
    val orderNo: String,
    val amount: Long,
    val paymentKey: String?,
    val status: String,
    val reason: String?,
    /** refunded 이벤트의 이번 환불액 */
    val refundAmount: Long?,
    /** 누적 환불액 */
    val refundedAmount: Long,
    val occurredAt: Instant,
)

/** `payment.reconciliation.settled` — settlement 가 PG 입금 분개를 만든다 */
data class SettledPayload(
    val date: String,
    val orderId: Long,
    val orderNo: String,
    val paymentKey: String,
    val grossAmount: Long,
    val pgFee: Long,
    val depositAmount: Long,
)
