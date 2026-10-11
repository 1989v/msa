package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionAccessRepositoryPort
import com.kgd.place.application.attraction.port.AttractionCongestionRepositoryPort
import com.kgd.place.application.attraction.port.AttractionExtrasRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRelatedRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.port.GocampingSiteRepositoryPort
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.application.attraction.usecase.LookupAttractionExtrasUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionBarrierFreeUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionWellnessUseCase
import com.kgd.place.domain.attraction.model.AttractionAccess
import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.AttractionWellness
import com.kgd.place.domain.attraction.model.CongestionDay
import com.kgd.place.domain.attraction.model.CongestionForecast
import com.kgd.place.domain.attraction.model.NameMatch
import com.kgd.place.domain.attraction.model.RelatedTarget
import com.kgd.place.domain.attraction.model.TransitKind
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 값은 운영 표본(2026-10-02, place-ingest `tests/fixtures/phase2-barrier-free-wellness.json`)에서 왔다 —
 * 마곡사 125894 의 목록 행 · 경복궁 126508 의 상세 문장 · 빈 상세를 준 3305925, 웰니스 국문 2994116(EX050100) · 127956.
 */
class AttractionExtrasServiceTest : BehaviorSpec({
    val repository = mockk<AttractionExtrasRepositoryPort>()
    val congestion = mockk<AttractionCongestionRepositoryPort>()
    val related = mockk<AttractionRelatedRepositoryPort>()
    val attractions = mockk<AttractionRepositoryPort>()
    val gocamping = mockk<GocampingSiteRepositoryPort>()
    val access = mockk<AttractionAccessRepositoryPort>()
    val service = AttractionExtrasService(repository, congestion, related, attractions, gocamping, access)

    val listRaw = """{"contentid":"125894","contenttypeid":"12","title":"마곡사 [유네스코 세계유산]","modifiedtime":"20251224171858"}"""
    val detailRaw = """{"contentid":"126508","wheelchair":"대여가능","restroom":"장애인 화장실 있음","elevator":""}"""
    val modified = LocalDateTime.of(2025, 12, 24, 17, 18, 58)
    val synced = LocalDateTime.of(2026, 10, 3, 2, 41)

    beforeTest {
        clearMocks(repository, congestion, related, attractions, gocamping, access)
        every { congestion.findForecasts(any(), any()) } returns emptyList()
        every { access.findByAttractionIds(any()) } returns emptyList()
        every { access.findBusCoverage(any()) } returns emptyMap()
        every { related.findLinked(any(), any()) } returns emptyList()
        every { gocamping.findCampingInfo(any()) } returns emptyMap()
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

    Given("재색인이 집중률이 있는 id 묶음을 조회할 때") {
        // 해운대구 운영 표본(2026-10-02): 「해운대해수욕장」 정확 일치. 같은 관광지에 정규화로 이은 다른 이름이 하나 더 있다고 둔다
        val oct2 = LocalDate.of(2026, 10, 2)
        fun days(vararg rates: Double) = rates.mapIndexed { i, r -> CongestionDay(oct2.plusDays(i.toLong()), r) }
        Then("화면에 쓰는 매칭(정확·정규화)만 묻고, 한 관광지에 둘이 이어졌으면 정확 쪽을 날짜 순으로 싣는다") {
            val asked = slot<Set<NameMatch>>()
            every { repository.findBarrierFreeByAttractionIds(any()) } returns emptyList()
            every { repository.findWellnessByAttractionIds(any()) } returns emptyList()
            every { congestion.findForecasts(listOf(31L, 32L), capture(asked)) } returns listOf(
                CongestionForecast(31L, NameMatch.NORMALIZED, oct2.plusDays(29), days(10.0, 20.0)),
                CongestionForecast(31L, NameMatch.EXACT, oct2.plusDays(29), days(47.16, 52.5)),
            )

            service.lookup(listOf(31L, 32L)) shouldBe listOf(
                LookupAttractionExtrasUseCase.Found(
                    31L, null, null,
                    LookupAttractionExtrasUseCase.Congestion(
                        "EXACT",
                        listOf(LookupAttractionExtrasUseCase.Day("2026-10-02", 47.16), LookupAttractionExtrasUseCase.Day("2026-10-03", 52.5)),
                    ),
                ),
            )
            // 포함 매칭은 정밀도 확인 전(Q-P2-MATCH)이라 묻지도 않는다
            asked.captured shouldBe setOf(NameMatch.EXACT, NameMatch.NORMALIZED)
        }
    }

    Given("재색인이 연관 관광지가 있는 id 묶음을 조회할 때") {
        // 해운대구 202608 운영 표본 모양: 「해운대해수욕장」 출발(정확) — 관광지·음식 대상이 순위 순으로 섞여 있다
        fun target(rank: Int, lcls: String, id: Long?, method: NameMatch) =
            RelatedTarget(rank, "대상 $rank", lcls, null, "자연경관(하천/해양)", "26350", id, method)
        Then("화면에 쓰는 매칭(정확·정규화)으로 이은 출발만 묻고, 우리 행으로 이어진 대상만(분류 무관) 순위 · 원천 소분류로 싣는다 — 이어진 대상이 없으면 항목이 없다") {
            val asked = slot<Set<NameMatch>>()
            every { repository.findBarrierFreeByAttractionIds(any()) } returns emptyList()
            every { repository.findWellnessByAttractionIds(any()) } returns emptyList()
            every { related.findLinked(listOf(41L, 42L, 43L), capture(asked)) } returns listOf(
                AttractionRelated(
                    "d123", "해운대해수욕장", "26350", "202608", "[]", 41L, NameMatch.EXACT,
                    listOf(target(1, "음식", 701L, NameMatch.EXACT), target(2, "관광지", 601L, NameMatch.NORMALIZED), target(3, "관광지", 602L, NameMatch.CONTAINS)),
                ),
                // 우리 음식점 행으로 이어진 음식 대상은 낸다
                AttractionRelated("e456", "해운대시장", "26350", "202608", "[]", 42L, NameMatch.EXACT, listOf(target(1, "음식", 702L, NameMatch.EXACT))),
                // 대상이 우리 행으로 이어지지 않은 출발 — 링크할 곳이 없어 항목이 없다
                AttractionRelated("f789", "동백섬", "26350", "202608", "[]", 43L, NameMatch.EXACT, listOf(target(1, "음식", null, NameMatch.NONE))),
            )

            service.lookup(listOf(41L, 42L, 43L)) shouldBe listOf(
                LookupAttractionExtrasUseCase.Found(
                    41L, null, null, null,
                    listOf(
                        LookupAttractionExtrasUseCase.RelatedPlace(1, 701L, "자연경관(하천/해양)"),
                        LookupAttractionExtrasUseCase.RelatedPlace(2, 601L, "자연경관(하천/해양)"),
                    ),
                ),
                LookupAttractionExtrasUseCase.Found(42L, null, null, null, listOf(LookupAttractionExtrasUseCase.RelatedPlace(1, 702L, "자연경관(하천/해양)"))),
            )
            asked.captured shouldBe setOf(NameMatch.EXACT, NameMatch.NORMALIZED, NameMatch.CONTAINS)
        }
        Then("포함 매칭 출발은 우리 행이 관광 분류일 때만 낸다 — 캠핑장·음식점에 붙은 것은 뺀다") {
            every { repository.findBarrierFreeByAttractionIds(any()) } returns emptyList()
            every { repository.findWellnessByAttractionIds(any()) } returns emptyList()
            every { related.findLinked(listOf(44L, 45L), any()) } returns listOf(
                AttractionRelated("g1", "고려청자박물관", "46810", "202608", "[]", 44L, NameMatch.CONTAINS, listOf(target(1, "관광지", 703L, NameMatch.EXACT))),
                AttractionRelated("g2", "운문사", "47820", "202608", "[]", 45L, NameMatch.CONTAINS, listOf(target(1, "관광지", 704L, NameMatch.EXACT))),
            )
            fun ours(id: Long, cat: String, title: String) = mockk<Attraction> {
                every { this@mockk.id } returns id
                every { category } returns cat
                every { titleDisplay } returns title
            }
            every { attractions.findAllByIds(listOf(44L, 45L)) } returns listOf(
                ours(44L, "culture", "강진 고려청자박물관"),
                ours(45L, "stay", "운문사계절 캠핑장"),
            )

            service.lookup(listOf(44L, 45L)).map { it.attractionId } shouldBe listOf(44L)
        }
    }

    Given("캠핑장 정보가 있는 id 를 조회할 때") {
        Then("고캠핑 원문 중 화면에 내는 키만 담아 싣고, 다른 부가 정보가 없어도 항목이 생긴다") {
            every { repository.findBarrierFreeByAttractionIds(any()) } returns emptyList()
            every { repository.findWellnessByAttractionIds(any()) } returns emptyList()
            every { gocamping.findCampingInfo(listOf(51L, 52L)) } returns mapOf(51L to """{"induty":"일반야영장","animalCmgCl":"가능"}""")

            service.lookup(listOf(51L, 52L)).map { it.attractionId to it.camping } shouldBe
                listOf(51L to """{"induty":"일반야영장","animalCmgCl":"가능"}""")
        }
    }

    Given("가는 법이 있는 id 묶음을 조회할 때") {
        Then("줄은 철도→버스·순위 순으로 싣고, 줄이 없어도 버스 미연계 시군구면 항목이 생기며, 연계 지역의 빈 관광지는 빠진다") {
            every { repository.findBarrierFreeByAttractionIds(any()) } returns emptyList()
            every { repository.findWellnessByAttractionIds(any()) } returns emptyList()
            val date = LocalDate.of(2024, 12, 31)
            every { access.findByAttractionIds(listOf(61L, 62L, 63L)) } returns listOf(
                AttractionAccess(61L, TransitKind.BUS, 1, "11:GGB123000289", "가락시장역4번출구.제일오피스텔", null, null, 120, LocalDate.of(2025, 10, 31)),
                AttractionAccess(61L, TransitKind.RAIL, 2, "0130|I4101|종로3가|1호선", "종로3가", "Jongno 3(sam)ga", "1·3호선", 1_000, date),
                AttractionAccess(61L, TransitKind.RAIL, 1, "0133|I4101|서울역|1호선", "서울역", "Seoul Station", "1·4호선", 999, date),
            )
            // 62 는 줄이 없고 강릉시(미연계), 63 은 줄이 없고 연계 지역
            every { access.findBusCoverage(listOf(61L, 62L, 63L)) } returns mapOf(61L to true, 62L to false, 63L to true)

            val found = service.lookup(listOf(61L, 62L, 63L)).associateBy { it.attractionId }
            found.keys shouldBe setOf(61L, 62L)
            found.getValue(61L).access!!.stops.map { it.kind to it.name } shouldBe
                listOf("RAIL" to "서울역", "RAIL" to "종로3가", "BUS" to "가락시장역4번출구.제일오피스텔")
            found.getValue(61L).access!!.stops.first().let { it.distanceM to it.lines } shouldBe (999 to "1·4호선")
            found.getValue(61L).access!!.stops.first().baseDate shouldBe "2024-12-31"
            found.getValue(62L).access shouldBe LookupAttractionExtrasUseCase.Access(emptyList(), false)
        }
    }
})
