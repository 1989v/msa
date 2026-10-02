package com.kgd.place.presentation.attraction.dto

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.time.LocalDate
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
    Given("수집기가 보내는 행사 bulk 항목 JSON (날짜는 ISO, 원문은 행 문자열)") {
        // searchFestival2 운영 표본(2026-10-02) 첫 행을 수집기가 정규화한 모양
        val raw = """{"contentid":"4116982","contenttypeid":"15","eventstartdate":"20261107","eventenddate":"20261108"}"""
        val body = """
            {"contentId":"4116982","lang":"ko","title":"산북AI김장문화축제",
             "latitude":37.4008741346,"longitude":127.4451502631,"contentTypeId":"15",
             "eventStartDate":"2026-11-07","eventEndDate":"2026-11-08",
             "listRaw":${jacksonObjectMapper().writeValueAsString(raw)}}
        """.trimIndent()
        val mapper = jacksonObjectMapper()

        When("역직렬화해 커맨드로 바꾸면") {
            val command = mapper.readValue<UpsertAttractionItem>(body).toCommand()

            Then("날짜와 원문이 그대로 건너간다") {
                command.eventStartDate shouldBe LocalDate.of(2026, 11, 7)
                command.eventEndDate shouldBe LocalDate.of(2026, 11, 8)
                command.listRaw shouldBe raw
            }
        }
    }
})
