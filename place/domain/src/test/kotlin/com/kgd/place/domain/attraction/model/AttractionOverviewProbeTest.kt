package com.kgd.place.domain.attraction.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class AttractionOverviewProbeTest : BehaviorSpec({
    val checkedAt = LocalDateTime.of(2026, 8, 19, 4, 0)

    given("AttractionOverviewProbe 생성 시") {
        `when`("유효한 (contentId, lang) 이 주어지면") {
            then("수집기가 쓰는 lang:contentId 키를 제공해야 한다") {
                val probe = AttractionOverviewProbe.create("126508", "ko", checkedAt)
                probe.key shouldBe "ko:126508"
                probe.checkedAt shouldBe checkedAt
            }
        }
        `when`("지원하지 않는 언어면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> { AttractionOverviewProbe.create("126508", "jp") }
            }
        }
        `when`("contentId 가 비어 있으면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> { AttractionOverviewProbe.create(" ", "ko") }
            }
        }
    }

    given("재확인 시각 갱신 시") {
        `when`("markCheckedAt 을 호출하면") {
            then("자연키는 그대로 두고 확인 시각만 바뀌어야 한다") {
                val probe = AttractionOverviewProbe.create("126508", "ko", checkedAt)
                probe.markCheckedAt(checkedAt.plusDays(30))
                probe.key shouldBe "ko:126508"
                probe.checkedAt shouldBe checkedAt.plusDays(30)
            }
        }
    }

    given("Attraction 과의 관계") {
        `when`("목록 재동기화(syncFrom)가 일어나도") {
            then("probe 는 Attraction 의 필드가 아니므로 영향받지 않아야 한다") {
                // ADR-0070 §1 — 보존 예외를 늘리지 않기 위해 테이블을 분리했다.
                // syncFrom 이 건드릴 수 있는 표면에 probe 가 없다는 것을 회귀로 못 박는다.
                val attraction = Attraction.create(
                    contentId = "126508", lang = "ko", title = "경복궁",
                    latitude = 37.5788, longitude = 126.9770, overview = "조선의 법궁",
                )
                val fromList = Attraction.create(
                    contentId = "126508", lang = "ko", title = "경복궁",
                    latitude = 37.5788, longitude = 126.9770,
                )
                attraction.syncFrom(fromList)
                attraction.overview shouldBe "조선의 법궁"
            }
        }
    }
})
