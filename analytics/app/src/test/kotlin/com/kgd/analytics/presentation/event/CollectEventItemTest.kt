package com.kgd.analytics.presentation.event

import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import com.kgd.analytics.presentation.event.dto.CollectEventItem
import com.kgd.analytics.presentation.event.dto.CollectEventsRequest
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.maps.shouldContainExactly
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

/**
 * 화면이 보내는 본문을 **그대로** 읽어 본다 — 계측은 실패해도 화면이 안 깨지도록 설계돼 있어,
 * 본문 거절(400)은 조용한 유실이다. 통합 검색의 `understoodType: null` 이 실제로 그렇게 버려졌다.
 */
class CollectEventItemTest : BehaviorSpec({

    val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()

    fun body(payload: String) = """
        {"events":[{"entityType":"SEARCH","entityId":"하이브리드 검색","action":"SEARCH",
         "screenType":"UNIFIED_SEARCH","sectionId":"SEARCH_GROUP","viewId":"v1","occurredAt":1758300000000,
         "payload":$payload}]}
    """.trimIndent()

    Given("payload 에 값이 null 인 키가 있는 본문") {
        When("읽으면") {
            val request = mapper.readValue(
                body("""{"understoodType":null,"residual":"하이브리드 검색"}"""),
                CollectEventsRequest::class.java,
            )

            Then("거절하지 않는다") {
                request.events.size shouldBe 1
            }
            Then("null 키는 저장에서 빠진다 — JSON 에서 「값이 null」과 「키가 없다」는 같다") {
                val event = request.events.first().toEvent("visitor", "session", null)
                event.payload shouldContainExactly mapOf("residual" to "하이브리드 검색")
                event.entityType shouldBe EntityType.SEARCH
                event.action shouldBe EventAction.SEARCH
            }
        }
    }

    Given("통합 검색이 더한 대상(CONCEPT)") {
        When("읽으면") {
            val json = body("null").replace("\"entityType\":\"SEARCH\"", "\"entityType\":\"CONCEPT\"")
            Then("아는 값이다") {
                mapper.readValue(json, CollectEventsRequest::class.java)
                    .events.first().entityType shouldBe EntityType.CONCEPT
            }
        }
    }

    Given("eventId — 재전송을 가려내는 열쇠") {
        When("viewId 와 섹션이 있는 목록 이벤트면") {
            Then("(viewId, entityType, entityId, sectionId, action) 으로 짓는다 — 같은 대상의 선택·지도 열기·찜은 섹션이 달라 다른 행이다") {
                mapper.readValue(body("null"), CollectEventsRequest::class.java)
                    .events.first().toEvent("visitor", "session", null)
                    .eventId shouldBe "v1:SEARCH:하이브리드 검색:SEARCH_GROUP:SEARCH"
            }
        }
        When("섹션이 없는 화면 대상(PAGE)이면") {
            val json = """{"events":[{"entityType":"PAGE","entityId":"place-hub","action":"SESSION_START",
                "screenType":"PLACE_HUB","viewId":"v1"}]}"""
            Then("섹션 자리는 빈 칸이다") {
                mapper.readValue(json, CollectEventsRequest::class.java)
                    .events.first().toEvent("visitor", "session", null)
                    .eventId shouldBe "v1:PAGE:place-hub::SESSION_START"
            }
        }
    }
    Given("occurredAt — 화면이 준 발생 시각") {
        val now = Instant.parse("2026-10-08T03:00:00Z")
        fun item(occurredAt: Instant) = CollectEventItem(
            entityType = EntityType.PAGE, entityId = "place-hub", action = EventAction.SESSION_START,
            occurredAt = occurredAt.toEpochMilli(),
        )

        When("허용 범위 안이면 (조금 전·조금 뒤)") {
            Then("그대로 쓴다 — 이탈 직전에 모아 보내므로 서버 시각보다 이르다") {
                val earlier = now.minus(Duration.ofHours(23))
                item(earlier).toEvent("visitor", "session", null, now).timestamp shouldBe earlier
                val skewed = now.plus(Duration.ofMinutes(4))
                item(skewed).toEvent("visitor", "session", null, now).timestamp shouldBe skewed
            }
        }
        When("미래로 5분을 넘으면") {
            Then("서버 시각으로 바꾼다") {
                item(now.plus(Duration.ofMinutes(6))).toEvent("visitor", "session", null, now).timestamp shouldBe now
            }
        }
        When("과거로 1일을 넘으면") {
            Then("서버 시각으로 바꾼다 — 보존기간(TTL)을 앞당겨 원장을 우회하거나 지난 집계를 바꾸지 못하게") {
                item(now.minus(Duration.ofDays(1)).minusSeconds(1)).toEvent("visitor", "session", null, now).timestamp shouldBe now
            }
        }
    }
})
