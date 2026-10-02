package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionExtrasRepositoryPort
import com.kgd.place.application.attraction.usecase.LookupAttractionExtrasUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionBarrierFreeUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionWellnessUseCase
import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import com.kgd.place.domain.attraction.model.AttractionWellness
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

/**
 * 값은 운영 표본(2026-10-02, place-ingest `tests/fixtures/phase2-barrier-free-wellness.json`)에서 왔다 —
 * 마곡사 125894 의 목록 행 · 경복궁 126508 의 상세 문장 · 빈 상세를 준 3305925, 웰니스 국문 2994116(EX050100) · 127956.
 */
class AttractionExtrasServiceTest : BehaviorSpec({
    val repository = mockk<AttractionExtrasRepositoryPort>()
    val service = AttractionExtrasService(repository)

    val listRaw = """{"contentid":"125894","contenttypeid":"12","title":"마곡사 [유네스코 세계유산]","modifiedtime":"20251224171858"}"""
    val detailRaw = """{"contentid":"126508","wheelchair":"대여가능","restroom":"장애인 화장실 있음","elevator":""}"""
    val modified = LocalDateTime.of(2025, 12, 24, 17, 18, 58)
    val synced = LocalDateTime.of(2026, 10, 3, 2, 41)

    beforeTest {
        clearMocks(repository)
        every { repository.saveBarrierFree(any()) } answers { firstArg<List<AttractionBarrierFree>>().size }
    }

    Given("무장애 목록을 적재할 때") {
        When("국문 관광지에 붙는 contentId 와 안 붙는 contentId 가 섞여 오면") {
            Then("붙는 것만 저장하고 이미 받은 상세는 그대로 두며, 못 붙은 건수와 표본을 돌려준다") {
                every { repository.findAttractionIds("ko", setOf("125894", "3305925")) } returns mapOf("125894" to 11L)
                every { repository.findBarrierFreeByContentIds(setOf("125894")) } returns listOf(
                    AttractionBarrierFree(11L, "125894", "{}", null, detailRaw, synced, listOf("WHEELCHAIR", "RESTROOM"), 1),
                )
                val saved = slot<List<AttractionBarrierFree>>()
                every { repository.saveBarrierFree(capture(saved)) } returns 1

                val applied = service.applyList(
                    listOf(
                        SyncAttractionBarrierFreeUseCase.ListItem("125894", listRaw, modified),
                        SyncAttractionBarrierFreeUseCase.ListItem("3305925", "{}", null),
                    ),
                )

                applied shouldBe SyncAttractionBarrierFreeUseCase.ListApplied(1, 1, listOf("3305925"))
                val row = saved.captured.single()
                row.listRaw shouldBe listRaw
                row.listModifiedAt shouldBe modified
                row.detailRaw shouldBe detailRaw
                row.detailSyncedAt shouldBe synced
                row.flags shouldBe listOf("WHEELCHAIR", "RESTROOM")
            }
        }
    }

    Given("무장애 상세를 적재할 때") {
        When("목록으로 붙은 곳과 목록에 없는 곳의 상세가 오면") {
            Then("목록에 있는 곳만 원문·플래그·받은 시각을 바꾼다") {
                every { repository.findBarrierFreeByContentIds(setOf("126508", "3305925")) } returns listOf(
                    AttractionBarrierFree(11L, "126508", listRaw, modified, null, null, emptyList(), null),
                )
                val saved = slot<List<AttractionBarrierFree>>()
                every { repository.saveBarrierFree(capture(saved)) } returns 1

                service.applyDetails(
                    listOf(
                        SyncAttractionBarrierFreeUseCase.DetailItem("126508", detailRaw, listOf("WHEELCHAIR", "RESTROOM"), 1, synced),
                        SyncAttractionBarrierFreeUseCase.DetailItem("3305925", null, emptyList(), 1, synced),
                    ),
                ) shouldBe 1

                val row = saved.captured.single()
                row.listRaw shouldBe listRaw
                row.detailRaw shouldBe detailRaw
                row.detailSyncedAt shouldBe synced
                row.flagsRuleVer shouldBe 1
            }
        }
    }

    Given("웰니스 태그를 바꿀 때") {
        When("국문 목록이 오면") {
            Then("붙는 곳만 그 언어로 통째로 바꾸고, 이번 목록에 없는 옛 태그 수를 센다") {
                val rows = slot<List<AttractionWellness>>()
                every { repository.findAttractionIds("ko", setOf("2994116", "127956")) } returns mapOf("2994116" to 21L)
                every { repository.replaceWellness("ko", capture(rows), any()) } returns setOf(21L, 22L)

                service.replace(
                    "ko",
                    listOf(
                        SyncAttractionWellnessUseCase.Item("2994116", "EX050100", """{"contentId":"2994116"}"""),
                        SyncAttractionWellnessUseCase.Item("127956", "EX050100", """{"contentId":"127956"}"""),
                    ),
                ) shouldBe SyncAttractionWellnessUseCase.Applied(matched = 1, unmatched = 1, removed = 1)
                rows.captured.single() shouldBe AttractionWellness(21L, "2994116", "ko", "EX050100", """{"contentId":"2994116"}""")
            }
        }
        When("빈 목록이나 모르는 언어가 오면") {
            Then("거부하고 아무것도 지우지 않는다") {
                shouldThrow<IllegalArgumentException> { service.replace("ko", emptyList()) }
                shouldThrow<IllegalArgumentException> {
                    service.replace("ja", listOf(SyncAttractionWellnessUseCase.Item("2994116", "EX050100", "{}")))
                }
                verify(exactly = 0) { repository.replaceWellness(any(), any(), any()) }
            }
        }
    }

    Given("재색인이 id 묶음으로 조회할 때") {
        Then("상세를 받은 무장애와 웰니스를 한 항목에 싣고, 목록만 있는 곳과 아무것도 없는 곳은 빠진다") {
            every { repository.findBarrierFreeByAttractionIds(listOf(11L, 12L, 21L, 30L)) } returns listOf(
                AttractionBarrierFree(11L, "126508", listRaw, modified, detailRaw, synced, listOf("WHEELCHAIR", "RESTROOM"), 1),
                AttractionBarrierFree(12L, "2392995", listRaw, modified, null, null, emptyList(), null),
            )
            every { repository.findWellnessByAttractionIds(listOf(11L, 12L, 21L, 30L)) } returns listOf(
                AttractionWellness(11L, "126508", "ko", "EX050100", "{}"),
                AttractionWellness(21L, "2994116", "ko", "EX050100", "{}"),
            )

            service.lookup(listOf(11L, 12L, 21L, 30L)) shouldBe listOf(
                LookupAttractionExtrasUseCase.Found(
                    11L,
                    LookupAttractionExtrasUseCase.BarrierFree(listOf("WHEELCHAIR", "RESTROOM"), detailRaw),
                    LookupAttractionExtrasUseCase.Wellness("EX050100"),
                ),
                LookupAttractionExtrasUseCase.Found(21L, null, LookupAttractionExtrasUseCase.Wellness("EX050100")),
            )
        }
    }
})
