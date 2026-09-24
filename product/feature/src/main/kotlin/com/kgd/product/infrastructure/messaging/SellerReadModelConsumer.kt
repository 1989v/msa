package com.kgd.product.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.product.application.seller.usecase.SyncProductSellerUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * `seller.seller.*` → 판매자 읽기 모델(`product_seller`). 상품 쓰기 권한과 판매 가능 여부가 이 행을 본다.
 *
 * 다섯 토픽을 모두 받는다 — 페이로드의 `status` 가 상태 전체라 토픽으로 전이를 따로 해석하지 않는다.
 * 순서 역전(아웃박스 재시도)은 `occurredAt` 으로 거르고, 같은 이벤트 재전달은 멱등 원장으로 거른다.
 */
@Component
class SellerReadModelConsumer(
    private val syncProductSellerUseCase: SyncProductSellerUseCase,
    private val objectMapper: ObjectMapper,
    // 한정자 필수 — 폴드된 호스트에는 도메인 수만큼 핸들러가 있다(ADR-0093)
    @Qualifier("productIdempotentEventHandler") private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = [
            "seller.seller.applied",
            "seller.seller.approved",
            "seller.seller.suspended",
            "seller.seller.reactivated",
            "seller.seller.updated",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onSellerEvent(record: ConsumerRecord<String, String>) {
        val node = objectMapper.readTree(record.value())
        val command = SyncProductSellerUseCase.Command(
            sellerId = requireNotNull(node.get("sellerId")) { "sellerId 없음: topic=${record.topic()}" }.asLong(),
            memberId = requireNotNull(node.get("memberId")) { "memberId 없음: topic=${record.topic()}" }.asString(),
            status = requireNotNull(node.get("status")) { "status 없음: topic=${record.topic()}" }.asString(),
            occurredAt = instantOf(requireNotNull(node.get("occurredAt")) { "occurredAt 없음: topic=${record.topic()}" }),
        )

        val eventId = node.get("eventId")?.asString()?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            // occurredAt 비교로 같은 결과에 수렴하므로 원장 없이 반영해도 안전하다 (ADR-0029 §4)
            log.warn { "missing eventId topic=${record.topic()} — graceful degrade, executing without dedup" }
            idempotentMetrics.missingId(CONSUMER_GROUP)
            syncProductSellerUseCase.execute(command)
            return
        }
        idempotentEventHandler.process(eventId, CONSUMER_GROUP) { syncProductSellerUseCase.execute(command) }
    }

    /** Instant 는 설정에 따라 ISO 문자열 또는 epoch 초(소수)로 직렬화된다 — 둘 다 받는다 */
    private fun instantOf(node: JsonNode): Instant =
        if (node.isNumber) {
            val seconds = node.decimalValue()
            Instant.ofEpochSecond(seconds.toLong(), seconds.remainder(BigDecimal.ONE).movePointRight(9).toLong())
        } else {
            Instant.parse(node.asString())
        }

    companion object {
        private const val CONSUMER_GROUP = "product-seller-sync"
    }
}
