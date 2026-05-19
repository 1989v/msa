package com.kgd.analytics.infrastructure.streaming

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class ProductMetricsTest : BehaviorSpec({

    fun event(type: EventType, payload: Map<String, Any> = emptyMap()) = AnalyticsEvent(
        eventId = "evt-1",
        eventType = type,
        userId = null,
        visitorId = "v1",
        sessionId = "s1",
        timestamp = Instant.now(),
        experimentAssignments = null,
        payload = payload
    )

    Given("ProductMetrics") {
        When("PRODUCT_VIEW, PRODUCT_CLICK, ORDER_COMPLETE 를 더하면") {
            val m = ProductMetrics()
            m.add(event(EventType.PRODUCT_VIEW))
            m.add(event(EventType.PRODUCT_VIEW))
            m.add(event(EventType.PRODUCT_CLICK))
            m.add(event(EventType.ORDER_COMPLETE, mapOf("amount" to 1000.0)))

            Then("impressions / clicks / orders 카운트가 올바름") {
                m.impressions shouldBe 2
                m.clicks shouldBe 1
                m.orders shouldBe 1
            }
            Then("gmv 가 amount 합산으로 올바름") {
                m.gmv shouldBe 1000.0
            }
        }

        When("ORDER_COMPLETE payload 에 amount 가 없고 totalPrice 가 있으면") {
            val m = ProductMetrics()
            m.add(event(EventType.ORDER_COMPLETE, mapOf("totalPrice" to 5000)))

            Then("totalPrice 값을 가져옴") {
                m.gmv shouldBe 5000.0
            }
        }

        When("ORDER_COMPLETE payload 의 amount 가 String 으로 들어오면") {
            val m = ProductMetrics()
            m.add(event(EventType.ORDER_COMPLETE, mapOf("amount" to "1234.5")))

            Then("문자열 -> Double 변환") {
                m.gmv shouldBe 1234.5
            }
        }

        When("ORDER_COMPLETE payload 에 amount/totalPrice/gmv 모두 누락") {
            val m = ProductMetrics()
            m.add(event(EventType.ORDER_COMPLETE, mapOf("productId" to "p1")))

            Then("gmv 는 0 (publisher 가 amount 발행하기 전까지의 안전 fallback)") {
                m.gmv shouldBe 0.0
            }
        }

        When("amount 가 음수면") {
            val m = ProductMetrics()
            m.add(event(EventType.ORDER_COMPLETE, mapOf("amount" to -100.0)))

            Then("0.0 fallback") {
                m.gmv shouldBe 0.0
            }
        }
    }
})
