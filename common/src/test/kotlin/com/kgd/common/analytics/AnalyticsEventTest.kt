package com.kgd.common.analytics

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.time.Instant
import java.util.UUID

class AnalyticsEventTest : BehaviorSpec({

    Given("이벤트 생성") {
        When("관광지가 목록에 보였을 때") {
            val event = AnalyticsEvent(
                eventId = UUID.randomUUID().toString(),
                entityType = EntityType.ATTRACTION,
                entityId = "11299",
                action = EventAction.IMPRESSION,
                placement = Placement(
                    screenType = "ATTRACTION_DETAIL",
                    screenRef = "17592",
                    sectionId = "NEARBY_ATTRACTIONS",
                    sectionIndex = 2,
                    itemIndex = 4,
                ),
                viewId = "v-1",
                userId = null,
                visitorId = "anon-visitor",
                sessionId = "s-1",
                timestamp = Instant.now(),
                experimentAssignments = null,
                payload = emptyMap(),
            )

            Then("대상과 동작이 각각 선다") {
                event.entityType shouldBe EntityType.ATTRACTION
                event.action shouldBe EventAction.IMPRESSION
                event.entityId shouldBe "11299"
                event.userId shouldBe null      // 비로그인도 기록한다
                event.eventId shouldNotBe null
            }

            Then("어느 화면 · 어느 섹션 · 그 안 몇 번째인지가 따로 남는다") {
                // 한 축(position)으로 누르면 「캐로셀 3번째」와 「3번째 섹션」이 구분되지 않는다
                val p = event.placement!!
                p.screenType shouldBe "ATTRACTION_DETAIL"
                p.screenRef shouldBe "17592"     // 어느 관광지 상세에서 보였나
                p.sectionIndex shouldBe 2
                p.itemIndex shouldBe 4
            }
        }
    }

    Given("두 축") {
        When("대상과 동작을 세면") {
            Then("각자 독립적으로 늘어난다 — 곱해지지 않는다") {
                // 한 축이던 시절 8종(PRODUCT_VIEW·PRODUCT_CLICK…)은 대상 × 동작이었다.
                // 이제 **대상이 늘어도 동작은 그대로다** — 그게 두 축으로 가른 이유다.
                // 대상 수는 고정값이 아니다(통합 검색이 CONCEPT·DEAL_OFFER·SERVICE 를 더했다).
                (EntityType.entries.size >= 6) shouldBe true
                EventAction.entries.size shouldBe 7
            }
            Then("노출과 클릭이 대상과 무관하게 지정된다") {
                // 「전 서비스 노출」이 action 하나로 걸러진다 — IN(…) 목록 유지가 필요 없다
                EventAction.entries.map { it.name } shouldNotBe emptyList<String>()
                EventAction.IMPRESSION.name shouldBe "IMPRESSION"
                EventAction.CLICK.name shouldBe "CLICK"
            }
        }
    }
})
