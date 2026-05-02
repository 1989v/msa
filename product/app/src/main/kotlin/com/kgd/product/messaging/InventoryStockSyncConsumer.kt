package com.kgd.product.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.product.application.product.usecase.SyncProductStockUseCase
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * ADR-0029 PR-7 — inventory 의 stock 변경 이벤트(`inventory.stock.{reserved,released,received}`)를
 * 구독해 product 의 read-only 재고 캐시(`products.stock`) 를 동기화한다.
 *
 * 이전에는 멱등 체크가 zero 였다 (Verification Follow-up §2). 본 PR 에서 common 의
 * [IdempotentEventHandler] 헬퍼를 도입한다. groupId="product-stock-sync" 단위로 dedup.
 *
 * ## 자연 멱등 보강
 * `syncProductStockUseCase.execute(...)` 는 `availableQty` 절대값을 `products.stock` 에 set 하는
 * idempotent assignment 다. 따라서 본 헬퍼의 dedup 은 race scenario 에서도 데이터 손상을 야기하지
 * 않으며, **중복 처리 부하 감소** 가 주된 효과다 (ADR-0029 §3 Policy A — 호출자 자연 멱등).
 *
 * ## graceful degrade
 * inventory outbox publisher 는 message body 에 `eventId` 를 enrichment 한다
 * ([com.kgd.common.messaging.outbox.OutboxPollingPublisher]). 그러나 외부 publisher / 테스트 픽스처가
 * eventId 를 누락한 페이로드를 보내는 케이스에 대비해 ADR-0029 §4 의 graceful degrade 를 따른다 —
 * WARN 로그 + [IdempotentMetrics.missingId] 메트릭 노출 + dedup 없이 동기화만 수행.
 */
@Component
class InventoryStockSyncConsumer(
    private val syncProductStockUseCase: SyncProductStockUseCase,
    private val objectMapper: ObjectMapper,
    private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @KafkaListener(
        topics = [
            "inventory.stock.reserved",
            "inventory.stock.released",
            "inventory.stock.received",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun onInventoryStockChanged(record: ConsumerRecord<String, String>) {
        log.info("Received inventory stock event: topic={}, key={}", record.topic(), record.key())

        val node = objectMapper.readTree(record.value())
        val productId = node.get("productId").asLong()
        val availableQty = node.get("availableQty")?.asInt()
        val rawEventId = node.get("eventId")?.asText().orEmpty()

        if (availableQty == null) {
            log.warn("availableQty not found in event payload, skipping stock sync: productId={}", productId)
            return
        }

        val eventId = parseEventId(rawEventId)
        if (eventId == null) {
            // ADR-0029 §4 graceful degrade — eventId 누락 시 멱등 검사 skip + 메트릭 노출.
            // syncProductStockUseCase 가 idempotent assignment 이므로 데이터 안전.
            log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
            idempotentMetrics.missingId(CONSUMER_GROUP)
            syncStock(productId, availableQty)
            return
        }

        idempotentEventHandler.process(eventId, CONSUMER_GROUP) {
            syncStock(productId, availableQty)
        }
    }

    private fun syncStock(productId: Long, availableQty: Int) {
        syncProductStockUseCase.execute(
            SyncProductStockUseCase.Command(
                productId = productId,
                availableQty = availableQty,
            )
        )
    }

    private fun parseEventId(raw: String): UUID? = try {
        raw.takeIf { it.isNotBlank() }?.let(UUID::fromString)
    } catch (e: IllegalArgumentException) {
        log.warn("Invalid eventId format, falling back to graceful degrade: raw={}", raw)
        null
    }

    companion object {
        private const val CONSUMER_GROUP = "product-stock-sync"
    }
}
