package com.kgd.place.presentation.attraction.dto

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

/**
 * DTO 에 필드를 넣는 것과 **그 값이 커맨드로 건너가는 것**은 다른 일이다.
 * 반려동물 필드가 양쪽에 다 있는데 `toCommand()` 만 안 옮겨서 9,583건이 조용히 버려졌다.
 */
class UpsertAttractionItemTest : BehaviorSpec({

    Given("보강 필드가 실린 upsert 항목") {
        val at = LocalDateTime.of(2026, 9, 8, 4, 0)
        val item = UpsertAttractionItem(
            contentId = "126508", lang = "ko", title = "경복궁",
            latitude = 37.5788, longitude = 126.977,
            overview = "조선의 법궁", introRaw = "{}", introSyncedAt = at,
            petAcmpyType = "전구역 동반가능", petRaw = "{\"acmpyTypeCd\":\"전구역 동반가능\"}", petSyncedAt = at,
        )

        When("커맨드로 바꾸면") {
            val command = item.toCommand()

            Then("보강 필드가 하나도 빠지지 않는다") {
                command.overview shouldBe "조선의 법궁"
                command.introSyncedAt shouldBe at
                command.petAcmpyType shouldBe "전구역 동반가능"
                command.petRaw shouldBe "{\"acmpyTypeCd\":\"전구역 동반가능\"}"
                command.petSyncedAt shouldBe at
            }
        }
    }
})
