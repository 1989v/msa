package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRelatedRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionRelatedUseCase
import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.NameMatch
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify

/** 값은 해운대구 202608 운영 표본(2026-10-02, place-ingest `tests/fixtures/phase2-related.json`) 모양 — 출발 정확 일치 1 · 못 맞춘 1. */
class AttractionRelatedServiceTest : BehaviorSpec({
    val repository = mockk<AttractionRelatedRepositoryPort>()
    val service = AttractionRelatedService(repository)
    val raw = """[{"baseYm":"202608","tAtsCd":"d123","tAtsNm":"해운대해수욕장","signguCd":"26350","rlteTatsNm":"동백섬","rlteRank":"1"}]"""
    fun target(rank: Int, id: Long?, method: String) =
        SyncAttractionRelatedUseCase.Target(rank, "동백섬", "관광지", "자연관광", "자연경관(하천/해양)", "26350", id, method)
    fun item(code: String, name: String, id: Long?, method: String, vararg targets: SyncAttractionRelatedUseCase.Target) =
        SyncAttractionRelatedUseCase.Item(code, name, raw, id, method, targets.toList())

    beforeTest {
        clearMocks(repository)
        every { repository.latestBaseYmBySigungu() } returns mapOf("26350" to "202607", "11110" to "202608")
    }

    Given("한 시군구의 연관 관광지를 적재할 때") {
        Then("이은 곳·못 이은 곳을 모두 그 달의 시군구 행으로 통째로 바꾸고, 대상 매칭을 그대로 담는다") {
            val rows = slot<List<AttractionRelated>>()
            every { repository.replaceSigungu("26350", capture(rows), any()) } returns 16

            service.replaceSigungu(
                "26350", "202608",
                listOf(item("d123", "해운대해수욕장", 501L, "EXACT", target(1, 601L, "EXACT"), target(2, null, "NONE")), item("e456", "SEA LIFE 부산아쿠아리움", null, "NONE")),
            ) shouldBe SyncAttractionRelatedUseCase.Applied(applied = 2, linked = 1, removed = 16)

            rows.captured.map { it.matchMethod } shouldBe listOf(NameMatch.EXACT, NameMatch.NONE)
            rows.captured.all { it.signguCd == "26350" && it.baseYm == "202608" } shouldBe true
            rows.captured.first().relatedRaw shouldBe raw
            rows.captured.first().targets.map { it.rank to it.matchMethod } shouldBe listOf(1 to NameMatch.EXACT, 2 to NameMatch.NONE)
        }
        Then("빈 목록 · 같은 출발 두 번 · 모르는 방법 · 방법과 id 가 어긋난 출발·대상 · 이미 가진 달보다 옛 달은 거부하고 아무것도 바꾸지 않는다") {
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", "202608", emptyList()) }
            shouldThrow<IllegalArgumentException> {
                service.replaceSigungu("26350", "202608", listOf(item("d123", "a", 1L, "EXACT"), item("d123", "b", 2L, "EXACT")))
            }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", "202608", listOf(item("d123", "a", 1L, "FUZZY"))) }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", "202608", listOf(item("d123", "a", null, "EXACT"))) }
            shouldThrow<IllegalArgumentException> {
                service.replaceSigungu("26350", "202608", listOf(item("d123", "a", 1L, "EXACT", target(1, 9L, "AMBIGUOUS"))))
            }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("11110", "202607", listOf(item("d123", "a", 1L, "EXACT"))) }
            verify(exactly = 0) { repository.replaceSigungu(any(), any(), any()) }
        }
    }

    Given("수집기가 상태를 물을 때") {
        Then("시군구별 최신 달을 그대로 돌려준다") {
            service.state() shouldBe mapOf("26350" to "202607", "11110" to "202608")
        }
    }
})
