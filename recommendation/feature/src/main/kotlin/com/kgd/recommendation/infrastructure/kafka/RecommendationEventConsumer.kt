package com.kgd.recommendation.infrastructure.kafka

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import com.kgd.recommendation.infrastructure.persistence.ClickHouseEventWriter
import com.kgd.recommendation.infrastructure.persistence.RecommendationEventRow
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

/**
 * `analytics.event.collected` 토픽을 별도 consumer group 으로 fan-out 소비.
 *
 * analytics 서비스가 이미 운영 중인 토픽을 그대로 활용 — analytics 서비스 코드 수정 없음.
 * Consumer group: `recommendation-events-consumer` (application.yml).
 *
 * EventType 매핑 (Recommendation action_type):
 * - PRODUCT_VIEW   → pageview
 * - PRODUCT_CLICK  → click
 * - ADD_TO_CART    → addwish
 * - ORDER_COMPLETE → reservation
 * - 그 외 (SEARCH_KEYWORD, PAGE_VIEW)  → 무시 (item-aware 신호 아님)
 */
@Component
class RecommendationEventConsumer(
    private val writer: ClickHouseEventWriter,
) {
    private val logger = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["analytics.event.collected"],
        groupId = "recommendation-events-consumer",
        containerFactory = "recommendationKafkaListenerContainerFactory",
    )
    fun handle(event: AnalyticsEvent) {
        val row = toRow(event) ?: return
        try {
            writer.insertBatch(listOf(row))
        } catch (e: Exception) {
            logger.error(e) { "Failed to insert recommendation event ${event.eventId}, retry" }
            throw e  // Kafka 가 재시도 → DLQ
        }
    }

    private fun toRow(event: AnalyticsEvent): RecommendationEventRow? {
        // 상품 축이 아닌 신호는 상품 추천에 쓰지 않는다 (ADR-0095 두 축)
        if (event.entityType != EntityType.PRODUCT) return null
        val actionType = mapAction(event.action) ?: return null
        val itemId = (event.payload["productId"] as? Number)?.toLong() ?: return null
        val userId = event.userId ?: 0L  // 비로그인 사용자 = 0
        val cityId = (event.payload["cityId"] as? Number)?.toLong() ?: 0L
        val categoryId = (event.payload["categoryId"] as? Number)?.toLong() ?: 0L

        return RecommendationEventRow(
            userId = userId,
            itemId = itemId,
            actionType = actionType,
            cityId = cityId,
            categoryId = categoryId,
            timestamp = event.timestamp,
        )
    }

    private fun mapAction(action: EventAction): String? = when (action) {
        EventAction.IMPRESSION -> "pageview"
        EventAction.CLICK -> "click"
        EventAction.ADD_TO_CART -> "addwish"
        EventAction.ORDER_COMPLETE -> "reservation"
        EventAction.SEARCH -> null                                   // item-aware 신호 아님
        EventAction.SESSION_START, EventAction.SESSION_END -> null    // 세션은 상품 추천 신호 아님
    }
}
