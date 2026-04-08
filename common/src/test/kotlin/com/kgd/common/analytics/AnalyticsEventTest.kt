package com.kgd.common.analytics

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.time.Instant
import java.util.UUID

class AnalyticsEventTest : BehaviorSpec({
    Given("AnalyticsEvent 생성") {
        When("모든 필수 필드를 제공하면") {
            val event = AnalyticsEvent(
                eventId = UUID.randomUUID().toString(),
                eventType = EventType.PRODUCT_VIEW,
                userId = 1L,
                visitorId = "visitor-123",
                sessionId = "session-456",
                timestamp = Instant.now(),
                experimentAssignments = mapOf(1L to "control"),
                payload = mapOf("productId" to 100L)
            )

            Then("이벤트가 정상 생성된다") {
                event.eventId shouldNotBe null
                event.eventType shouldBe EventType.PRODUCT_VIEW
                event.userId shouldBe 1L
                event.visitorId shouldBe "visitor-123"
            }
        }

        When("비로그인 사용자 (userId null)") {
            val event = AnalyticsEvent(
                eventId = UUID.randomUUID().toString(),
                eventType = EventType.PAGE_VIEW,
                userId = null,
                visitorId = "anon-visitor",
                sessionId = "session-789",
                timestamp = Instant.now(),
                experimentAssignments = null,
                payload = mapOf("pageType" to "home")
            )

            Then("userId가 null이어도 생성된다") {
                event.userId shouldBe null
                event.visitorId shouldBe "anon-visitor"
            }
        }
    }

    Given("EventType") {
        When("모든 이벤트 유형을 확인하면") {
            Then("6가지 유형이 존재한다") {
                EventType.entries.size shouldBe 6
            }
        }
    }
})
