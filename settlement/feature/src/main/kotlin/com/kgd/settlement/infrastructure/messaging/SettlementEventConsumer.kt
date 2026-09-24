package com.kgd.settlement.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase
import com.kgd.settlement.application.seller.usecase.SyncSettlementSellerUseCase
import com.kgd.settlement.application.statement.usecase.RegisterSettlementItemUseCase
import com.kgd.settlement.domain.ledger.model.LineAmounts
import com.kgd.settlement.domain.ledger.model.ShippingAmount
import com.kgd.settlement.domain.seller.model.SettlementSeller
import com.kgd.settlement.domain.statement.model.SettlementCycle
import com.kgd.settlement.infrastructure.config.SettlementKafkaConfig
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * 정산 도메인이 받는 이벤트 전부(그룹 `settlement-ledger`). settlement 는 다른 스키마를 읽지 않는다 — 판매자·안분·수수료는
 * order 이벤트가 싣고 온 값 그대로다(SR-3).
 *
 * 멱등은 두 겹: 이벤트 id 원장(`processed_event`) + 원천 자연 키(거래 source_key · 항목 item_key 유니크).
 * 페이로드 모양은 발행자의 페이로드 클래스(OrderOutboxEventAdapter · PaymentOutboxEventAdapter · SellerOutboxEventAdapter)를 따른다.
 */
@Component
class SettlementEventConsumer(
    private val ledger: RecordLedgerUseCase,
    private val items: RegisterSettlementItemUseCase,
    private val sellers: SyncSettlementSellerUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("settlementIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    /** 매입 분개 */
    @KafkaListener(topics = [ORDER_CONFIRMED], groupId = GROUP, containerFactory = FACTORY)
    fun onOrderConfirmed(record: ConsumerRecord<String, String>) = handle(record, OrderConfirmedMessage::class.java) { m ->
        ledger.recordCapture(
            RecordLedgerUseCase.Capture(
                orderId = m.orderId, payableAmount = m.payableAmount, lines = m.lines.map { it.toAmounts() },
                shipping = m.shippingLines.map { it.toAmount() }, confirmedAt = m.confirmedAt, eventId = m.eventId,
            ),
        )
    }

    /** 환불 분개 + 환불 키 */
    @KafkaListener(topics = [CLAIM_REFUNDED], groupId = GROUP, containerFactory = FACTORY)
    fun onClaimRefunded(record: ConsumerRecord<String, String>) = handle(record, ClaimRefundedMessage::class.java) { m ->
        ledger.recordRefund(
            RecordLedgerUseCase.Refund(
                claimId = m.claimId, orderId = m.orderId, refundAmount = m.refundAmount, lines = m.lines.map { it.toAmounts() },
                shipping = m.shippingLines.map { it.toAmount() }, refundedAt = m.refundedAt, eventId = m.eventId,
            ),
        )
    }

    /** PG 입금 분개 */
    @KafkaListener(topics = [RECONCILIATION_SETTLED], groupId = GROUP, containerFactory = FACTORY)
    fun onReconciliationSettled(record: ConsumerRecord<String, String>) = handle(record, ReconciliationSettledMessage::class.java) { m ->
        ledger.recordPgDeposit(
            RecordLedgerUseCase.PgDeposit(
                orderId = m.orderId, orderNo = m.orderNo, settleDate = LocalDate.parse(m.date),
                depositAmount = m.depositAmount, pgFee = m.pgFee, eventId = m.eventId,
            ),
        )
    }

    /** 정산 대상 — 확정 라인과(판매자 마지막 라인이면) 배송비 */
    @KafkaListener(topics = [LINE_PURCHASE_CONFIRMED], groupId = GROUP, containerFactory = FACTORY)
    fun onLinePurchaseConfirmed(record: ConsumerRecord<String, String>) = handle(record, LinePurchaseConfirmedMessage::class.java) { m ->
        items.register(
            RegisterSettlementItemUseCase.PurchaseConfirmed(
                orderId = m.orderId, line = m.line?.toAmounts(), shipping = m.shippingLine?.toAmount(), confirmedAt = m.confirmedAt,
            ),
        )
    }

    @KafkaListener(
        topics = ["seller.seller.applied", "seller.seller.approved", "seller.seller.suspended", "seller.seller.reactivated", "seller.seller.updated"],
        groupId = GROUP,
        containerFactory = FACTORY,
    )
    fun onSeller(record: ConsumerRecord<String, String>) = handle(record, SellerMessage::class.java) { m ->
        sellers.sync(SettlementSeller(m.sellerId, m.memberId, m.status, SettlementCycle.valueOf(m.settlementCycle), m.occurredAt))
    }

    private fun <T : SettlementMessage> handle(record: ConsumerRecord<String, String>, type: Class<T>, apply: (T) -> Unit) {
        val message = objectMapper.readValue(record.value(), type)
        val eventId = message.eventId?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        log.info { "Received ${record.topic()} key=${record.key()} eventId=$eventId" }
        if (eventId == null) {
            // 원천 자연 키가 둘째 겹으로 남아 있어 원장 없이 반영해도 거래가 두 번 생기지 않는다
            log.warn { "missing eventId topic=${record.topic()} — 원천 키 멱등에 기대 처리한다" }
            idempotentMetrics.missingId(GROUP)
            apply(message)
            return
        }
        idempotent.process(eventId, GROUP) { apply(message) }
    }

    companion object {
        const val ORDER_CONFIRMED = "order.order.confirmed"
        const val CLAIM_REFUNDED = "order.claim.refunded"
        const val LINE_PURCHASE_CONFIRMED = "order.line.purchase-confirmed"
        const val RECONCILIATION_SETTLED = "payment.reconciliation.settled"
        private const val GROUP = SettlementKafkaConfig.CONSUMER_GROUP
        private const val FACTORY = "settlementKafkaListenerContainerFactory"
    }
}

/** 수신 페이로드 공통 — 아웃박스 릴레이가 본문에 eventId 를 넣는다 */
sealed interface SettlementMessage {
    val eventId: String?
}

data class LineMessage(
    val orderItemId: Long,
    val sellerId: Long,
    val netSales: Long,
    val commission: Long,
    val platformCouponAllocation: Long,
    val pointAllocation: Long,
) {
    fun toAmounts() = LineAmounts(orderItemId, sellerId, netSales, commission, platformCouponAllocation, pointAllocation)
}

data class ShippingLineMessage(val sellerId: Long, val fee: Long) {
    fun toAmount() = ShippingAmount(sellerId, fee)
}

data class OrderConfirmedMessage(
    override val eventId: String? = null,
    val orderId: Long,
    val payableAmount: Long,
    val confirmedAt: Instant,
    val lines: List<LineMessage>,
    val shippingLines: List<ShippingLineMessage> = emptyList(),
) : SettlementMessage

data class ClaimRefundedMessage(
    override val eventId: String? = null,
    val claimId: Long,
    val orderId: Long,
    val refundAmount: Long,
    val refundedAt: Instant,
    val lines: List<LineMessage>,
    val shippingLines: List<ShippingLineMessage> = emptyList(),
) : SettlementMessage

data class ReconciliationSettledMessage(
    override val eventId: String? = null,
    val date: String,
    val orderId: Long,
    val orderNo: String,
    val depositAmount: Long,
    val pgFee: Long,
) : SettlementMessage

data class LinePurchaseConfirmedMessage(
    override val eventId: String? = null,
    val orderId: Long,
    val confirmedAt: Instant,
    val line: LineMessage? = null,
    val shippingLine: ShippingLineMessage? = null,
) : SettlementMessage

data class SellerMessage(
    override val eventId: String? = null,
    val sellerId: Long,
    val memberId: String,
    val status: String,
    val settlementCycle: String,
    val occurredAt: Instant,
) : SettlementMessage
