package com.kgd.fulfillment.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.fulfillment.application.ownership.usecase.SyncOwnershipUseCase
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
 * `product.item.*` · `seller.seller.*` → 이행 REST 소유 판정 읽기 모델(`product_owner` · `owner_seller`).
 *
 * 같은 이벤트 재전달은 멱등 원장(`fulfillment-ownership` 그룹)이, 순서 역전은 `occurredAt` 비교가 거른다.
 * 판매자 컬럼 이전의 상품 이벤트에는 sellerId 가 없다 — 그때 상품은 전부 플랫폼 판매자(1)로 백필됐으므로 1 로 읽는다.
 */
@Component
class FulfillmentOwnershipReadModelConsumer(
    private val sync: SyncOwnershipUseCase,
    private val objectMapper: ObjectMapper,
    @Qualifier("fulfillmentIdempotentEventHandler") private val idempotent: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(topics = ["product.item.created", "product.item.updated"], groupId = GROUP, containerFactory = FACTORY)
    fun onProduct(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncProduct(
            SyncOwnershipUseCase.Product(
                productId = node.required("productId").asLong(),
                sellerId = node.get("sellerId")?.takeUnless { it.isNull }?.asLong() ?: PLATFORM_SELLER_ID,
                // 옛 이벤트는 occurredAt 이 없다 — 소유는 바뀌지 않으므로 레코드 시각으로 충분하다
                occurredAt = node.get("occurredAt")?.takeUnless { it.isNull }?.let(::instantOf)
                    ?: Instant.ofEpochMilli(record.timestamp()),
            ),
        )
    }

    @KafkaListener(
        topics = [
            "seller.seller.applied",
            "seller.seller.approved",
            "seller.seller.suspended",
            "seller.seller.reactivated",
            "seller.seller.updated",
        ],
        groupId = GROUP,
        containerFactory = FACTORY,
    )
    fun onSeller(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncSeller(
            SyncOwnershipUseCase.Seller(
                sellerId = node.required("sellerId").asLong(),
                memberId = node.required("memberId").asString(),
                status = node.required("status").asString(),
                occurredAt = instantOf(node.required("occurredAt")),
            ),
        )
    }

    private fun handle(record: ConsumerRecord<String, String>, apply: (JsonNode) -> Unit) {
        val node = objectMapper.readTree(record.value())
        val eventId = node.get("eventId")?.asString()?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            // occurredAt 비교로 같은 결과에 수렴하므로 원장 없이 반영해도 안전하다 (ADR-0029 §4)
            log.warn { "missing eventId topic=${record.topic()} — graceful degrade, executing without dedup" }
            idempotentMetrics.missingId(GROUP)
            apply(node)
            return
        }
        idempotent.process(eventId, GROUP) { apply(node) }
    }

    /** Instant 는 설정에 따라 ISO 문자열 또는 epoch 초(소수)로 직렬화된다 — 둘 다 받는다 */
    private fun instantOf(node: JsonNode): Instant =
        if (node.isNumber) {
            val seconds = node.decimalValue()
            Instant.ofEpochSecond(seconds.toLong(), seconds.remainder(BigDecimal.ONE).movePointRight(9).toLong())
        } else {
            Instant.parse(node.asString())
        }

    private fun JsonNode.required(field: String): JsonNode =
        get(field)?.takeUnless { it.isNull } ?: throw IllegalArgumentException("필드 없음: $field")

    companion object {
        const val GROUP = "fulfillment-ownership"
        private const val FACTORY = "fulfillmentKafkaListenerContainerFactory"
        private const val PLATFORM_SELLER_ID = 1L
    }
}
