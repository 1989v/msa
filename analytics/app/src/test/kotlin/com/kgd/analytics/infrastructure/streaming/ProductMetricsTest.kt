package com.kgd.analytics.infrastructure.streaming

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class ProductMetricsTest : BehaviorSpec({

    fun event(
        action: EventAction,
        entityType: EntityType = EntityType.PRODUCT,
        payload: Map<String, Any> = emptyMap(),
    ) = AnalyticsEvent(
        eventId = "evt-1",
        entityType = entityType,
        entityId = "100",
        action = action,
        userId = null,
        visitorId = "v1",
        sessionId = "s1",
        timestamp = Instant.now(),
        experimentAssignments = null,
        payload = payload,
    )

    Given("ProductMetrics") {
        When("상품의 노출·클릭·주문을 더하면") {
            val m = ProductMetrics()
            m.add(event(EventAction.IMPRESSION))
            m.add(event(EventAction.IMPRESSION))
            m.add(event(EventAction.CLICK))
            m.add(event(EventAction.ORDER_COMPLETE, payload = mapOf("amount" to 1000.0)))

            Then("impressions / clicks / orders 카운트가 올바름") {
                m.impressions shouldBe 2
                m.clicks shouldBe 1
                m.orders shouldBe 1
                m.gmv shouldBe 1000.0
            }
        }

        When("다른 대상(관광지)의 노출이 섞여 들어오면") {
            val m = ProductMetrics()
            m.add(event(EventAction.IMPRESSION))
            m.add(event(EventAction.IMPRESSION, entityType = EntityType.ATTRACTION))
            m.add(event(EventAction.CLICK, entityType = EntityType.ATTRACTION))

            Then("상품 축만 센다 — 섞이면 상품 CTR 이 틀어진다") {
                // 두 축으로 가른 뒤 같은 action 이름을 다른 대상도 쓴다.
                // 대상을 안 보면 관광지 노출이 상품 분모로 들어간다.
                m.impressions shouldBe 1
                m.clicks shouldBe 0
            }
        }
    }
})
