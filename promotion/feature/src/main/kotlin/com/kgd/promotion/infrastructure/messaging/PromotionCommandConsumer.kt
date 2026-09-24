package com.kgd.promotion.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.promotion.application.hold.usecase.ProcessPromotionCommandUseCase
import com.kgd.promotion.domain.coupon.model.CouponLine
import com.kgd.promotion.infrastructure.config.PromotionKafkaConfig
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * 사가·클레임 명령 `promotion.command.{reserve,confirm,cancel,restore}` (키 = orderId).
 *
 * 업무상 실패(쿠폰 불가·잔액 부족·보류 만료)는 유스케이스가 `promotion.hold.failed` 로 답하고 정상 반환한다 —
 * 여기서 예외가 나는 것은 페이로드가 계약을 어긴 경우뿐이고, 그것만 DLT 로 간다.
 * 멱등은 두 겹: `processed_event` 원장(같은 이벤트 재배달) + orderId·restoreKey 로 한 번만 일어나는 효과.
 */
@Component
class PromotionCommandConsumer(
    private val commands: ProcessPromotionCommandUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("promotionIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(topics = [RESERVE], groupId = GROUP, containerFactory = FACTORY)
    fun onReserve(record: ConsumerRecord<String, String>) = handle(record) { c ->
        commands.reserve(
            ProcessPromotionCommandUseCase.Reserve(
                orderId = c.orderId,
                memberId = requireNotNull(c.memberId) { "memberId 가 없다" },
                userCouponId = c.userCouponId,
                couponDiscount = c.couponDiscount ?: 0L,
                pointAmount = c.pointAmount ?: 0L,
                lines = c.lines.orEmpty().map { CouponLine(it.sellerId, it.amount) },
            ),
        )
    }

    @KafkaListener(topics = [CONFIRM], groupId = GROUP, containerFactory = FACTORY)
    fun onConfirm(record: ConsumerRecord<String, String>) = handle(record) { c -> commands.confirm(c.orderId) }

    @KafkaListener(topics = [CANCEL], groupId = GROUP, containerFactory = FACTORY)
    fun onCancel(record: ConsumerRecord<String, String>) = handle(record) { c -> commands.cancel(c.orderId) }

    @KafkaListener(topics = [RESTORE], groupId = GROUP, containerFactory = FACTORY)
    fun onRestore(record: ConsumerRecord<String, String>) = handle(record) { c ->
        commands.restore(
            ProcessPromotionCommandUseCase.Restore(
                orderId = c.orderId,
                restoreKey = requireNotNull(c.restoreKey) { "restoreKey 가 없다 — 원복 멱등 키는 필수" },
                pointAmount = c.pointAmount ?: 0L,
                fullCancel = c.fullCancel ?: false,
            ),
        )
    }

    private fun handle(record: ConsumerRecord<String, String>, block: (PromotionCommandMessage) -> Unit) {
        val command = objectMapper.readValue(record.value(), PromotionCommandMessage::class.java)
        log.info { "Received ${record.topic()}: orderId=${command.orderId}" }
        val eventId = command.eventId?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            log.warn { "missing eventId topic=${record.topic()} — orderId 멱등에 기대 처리한다" }
            idempotentMetrics.missingId(GROUP)
            block(command)
            return
        }
        idempotent.process(eventId, GROUP) { block(command) }
    }

    companion object {
        const val RESERVE = "promotion.command.reserve"
        const val CONFIRM = "promotion.command.confirm"
        const val CANCEL = "promotion.command.cancel"
        const val RESTORE = "promotion.command.restore"
        private const val GROUP = PromotionKafkaConfig.CONSUMER_GROUP
        private const val FACTORY = "promotionKafkaListenerContainerFactory"
    }
}

/** `promotion.command.*` 페이로드. reserve 는 memberId·쿠폰·포인트·라인, restore 는 restoreKey·포인트·fullCancel */
data class PromotionCommandMessage(
    val eventId: String? = null,
    val orderId: Long,
    val memberId: String? = null,
    val userCouponId: Long? = null,
    val couponDiscount: Long? = null,
    val pointAmount: Long? = null,
    val lines: List<PromotionLineMessage>? = null,
    val restoreKey: String? = null,
    val fullCancel: Boolean? = null,
)

/** 쿠폰 대상 금액 계산용 라인 — 판매자와 판매가×수량(배송비 제외) */
data class PromotionLineMessage(val sellerId: Long, val amount: Long)
