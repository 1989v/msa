package com.kgd.recommendation.infrastructure.kafka

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
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
            entityType = EntityType.PRODUCT,
            entityId = "0",
            action = EventAction.IMPRESSION,
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
            entityType = EntityType.PRODUCT,
            entityId = "0",
            action = EventAction.ORDER_COMPLETE,
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
            entityType = EntityType.SEARCH,
            entityId = "0",
            action = EventAction.SEARCH,
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
            entityType = EntityType.PRODUCT,
            entityId = "0",
            action = EventAction.IMPRESSION,
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
            entityType = EntityType.PRODUCT,
            entityId = "0",
            action = EventAction.IMPRESSION,
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

    given("동작 매핑") {
        `when`("상품 축의 동작들을 넣으면") {
            then("IMPRESSION→pageview · CLICK→click · ADD_TO_CART→addwish · ORDER_COMPLETE→reservation") {
                listOf(
                    EventAction.IMPRESSION to "pageview",
                    EventAction.CLICK to "click",
                    EventAction.ADD_TO_CART to "addwish",
                    EventAction.ORDER_COMPLETE to "reservation",
                ).forEach { (action, expectedAction) ->
                    val w = mockk<ClickHouseEventWriter>(relaxed = true)
                    val c = RecommendationEventConsumer(w)
                    c.handle(AnalyticsEvent(
                        eventId = "evt-$action",
                        entityType = EntityType.PRODUCT,
                        entityId = "1",
                        action = action,
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

        `when`("상품이 아닌 대상이 같은 동작으로 오면") {
            then("추천 신호로 쓰지 않는다 — 두 축이라 action 이름이 겹친다") {
                // 관광지 클릭과 상품 클릭은 같은 CLICK 이다. 대상을 안 보면
                // 관광지 조회가 상품 추천 학습 데이터에 섞인다.
                val w = mockk<ClickHouseEventWriter>(relaxed = true)
                val c = RecommendationEventConsumer(w)
                c.handle(AnalyticsEvent(
                    eventId = "evt-attraction",
                    entityType = EntityType.ATTRACTION,
                    entityId = "11299",
                    action = EventAction.CLICK,
                    userId = 1L,
                    visitorId = "v",
                    sessionId = "s",
                    timestamp = Instant.now(),
                    experimentAssignments = null,
                    payload = mapOf("productId" to 1),
                ))
                verify(exactly = 0) { w.insertBatch(any()) }
            }
            then("광고 클릭도 쓰지 않는다 — 상품을 광고해도 광고 반응은 상품 선호가 아니다") {
                val w = mockk<ClickHouseEventWriter>(relaxed = true)
                val c = RecommendationEventConsumer(w)
                c.handle(AnalyticsEvent(
                    eventId = "evt-ad",
                    entityType = EntityType.AD,
                    entityId = "42",
                    action = EventAction.CLICK,
                    userId = 1L,
                    visitorId = "v",
                    sessionId = "s",
                    timestamp = Instant.now(),
                    experimentAssignments = null,
                    payload = mapOf("productId" to 1),
                ))
                verify(exactly = 0) { w.insertBatch(any()) }
            }
        }
    }
})
