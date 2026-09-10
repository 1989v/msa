package com.kgd.recommendation.infrastructure.kafka

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType
import com.kgd.recommendation.infrastructure.persistence.ClickHouseEventWriter
import com.kgd.recommendation.infrastructure.persistence.RecommendationEventRow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.Instant

class RecommendationEventConsumerTest : BehaviorSpec({

    val writer = mockk<ClickHouseEventWriter>(relaxed = true)
    val consumer = RecommendationEventConsumer(writer)

    given("PRODUCT_VIEW 이벤트 (productId, cityId, categoryId 모두 있음)") {
        val event = AnalyticsEvent(
            eventId = "evt-1",
            eventType = EventType.PRODUCT_VIEW,
            userId = 100L,
            visitorId = "v-1",
            sessionId = "s-1",
            timestamp = Instant.parse("2026-05-12T10:00:00Z"),
            experimentAssignments = null,
            payload = mapOf("productId" to 1001, "cityId" to 1, "categoryId" to 10),
        )

        `when`("handle 호출") {
            consumer.handle(event)
            then("action_type='pageview' 로 insert 된다") {
                val captured = slot<List<RecommendationEventRow>>()
                verify { writer.insertBatch(capture(captured)) }
                captured.captured.size shouldBe 1
                captured.captured[0].actionType shouldBe "pageview"
                captured.captured[0].itemId shouldBe 1001L
                captured.captured[0].cityId shouldBe 1L
                captured.captured[0].categoryId shouldBe 10L
                captured.captured[0].userId shouldBe 100L
            }
        }
    }

    given("ORDER_COMPLETE 이벤트") {
        val writer2 = mockk<ClickHouseEventWriter>(relaxed = true)
        val consumer2 = RecommendationEventConsumer(writer2)
        val event = AnalyticsEvent(
            eventId = "evt-2",
            eventType = EventType.ORDER_COMPLETE,
            userId = 200L,
            visitorId = "v-2",
            sessionId = "s-2",
            timestamp = Instant.now(),
            experimentAssignments = null,
            payload = mapOf("productId" to 2002, "cityId" to 1, "categoryId" to 20),
        )
        `when`("handle 호출") {
            consumer2.handle(event)
            then("action_type='reservation' 으로 insert") {
                val captured = slot<List<RecommendationEventRow>>()
                verify { writer2.insertBatch(capture(captured)) }
                captured.captured[0].actionType shouldBe "reservation"
            }
        }
    }

    given("SEARCH_KEYWORD 이벤트 (item-aware 신호 아님)") {
        val writer3 = mockk<ClickHouseEventWriter>(relaxed = true)
        val consumer3 = RecommendationEventConsumer(writer3)
        val event = AnalyticsEvent(
            eventId = "evt-3",
            eventType = EventType.SEARCH_KEYWORD,
            userId = 100L,
            visitorId = "v-3",
            sessionId = "s-3",
            timestamp = Instant.now(),
            experimentAssignments = null,
            payload = mapOf("keyword" to "서울 호텔"),
        )
        `when`("handle 호출") {
            consumer3.handle(event)
            then("insert 호출 안 됨 (skip)") {
                verify(exactly = 0) { writer3.insertBatch(any()) }
            }
        }
    }

    given("productId 없는 PRODUCT_VIEW 이벤트") {
        val writer4 = mockk<ClickHouseEventWriter>(relaxed = true)
        val consumer4 = RecommendationEventConsumer(writer4)
        val event = AnalyticsEvent(
            eventId = "evt-4",
            eventType = EventType.PRODUCT_VIEW,
            userId = 100L,
            visitorId = "v-4",
            sessionId = "s-4",
            timestamp = Instant.now(),
            experimentAssignments = null,
            payload = mapOf("foo" to "bar"),  // productId 없음
        )
        `when`("handle 호출") {
            consumer4.handle(event)
            then("insert 호출 안 됨 (productId 없음)") {
                verify(exactly = 0) { writer4.insertBatch(any()) }
            }
        }
    }

    given("비로그인 사용자 (userId=null)") {
        val writer5 = mockk<ClickHouseEventWriter>(relaxed = true)
        val consumer5 = RecommendationEventConsumer(writer5)
        val event = AnalyticsEvent(
            eventId = "evt-5",
            eventType = EventType.PRODUCT_VIEW,
            userId = null,
            visitorId = "v-5",
            sessionId = "s-5",
            timestamp = Instant.now(),
            experimentAssignments = null,
            payload = mapOf("productId" to 5005),
        )
        `when`("handle 호출") {
            consumer5.handle(event)
            then("userId=0 으로 insert (anonymous)") {
                val captured = slot<List<RecommendationEventRow>>()
                verify { writer5.insertBatch(capture(captured)) }
                captured.captured[0].userId shouldBe 0L
                captured.captured[0].itemId shouldBe 5005L
            }
        }
    }

    given("EventType 모든 케이스") {
        `when`("매핑 확인") {
            then("PRODUCT_VIEW → pageview, PRODUCT_CLICK → click, ADD_TO_CART → addwish, ORDER_COMPLETE → reservation, 그 외 null") {
                listOf(
                    EventType.PRODUCT_VIEW to "pageview",
                    EventType.PRODUCT_CLICK to "click",
                    EventType.ADD_TO_CART to "addwish",
                    EventType.ORDER_COMPLETE to "reservation",
                ).forEach { (eventType, expectedAction) ->
                    val w = mockk<ClickHouseEventWriter>(relaxed = true)
                    val c = RecommendationEventConsumer(w)
                    c.handle(AnalyticsEvent(
                        eventId = "evt-$eventType",
                        eventType = eventType,
                        userId = 1L,
                        visitorId = "v",
                        sessionId = "s",
                        timestamp = Instant.now(),
                        experimentAssignments = null,
                        payload = mapOf("productId" to 1),
                    ))
                    val captured = slot<List<RecommendationEventRow>>()
                    verify { w.insertBatch(capture(captured)) }
                    captured.captured[0].actionType shouldBe expectedAction
                }
            }
        }
    }
})
