package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionCongestionRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionCongestionUseCase
import com.kgd.place.domain.attraction.model.AttractionCongestion
import com.kgd.place.domain.attraction.model.CongestionMatch
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDate

/** 값은 해운대구 운영 표본(2026-10-02, place-ingest `tests/fixtures/phase2-congestion.json`) — 정확 일치 1 · 못 맞춘 1. */
class AttractionCongestionServiceTest : BehaviorSpec({
    val repository = mockk<AttractionCongestionRepositoryPort>()
    val service = AttractionCongestionService(repository)
    val oct2 = LocalDate.of(2026, 10, 2)
    val oct31 = LocalDate.of(2026, 10, 31)
    val raw = """[{"baseYmd":"20261002","areaCd":"26","areaNm":"부산광역시","signguCd":"26350","signguNm":"해운대구","tAtsNm":"해운대해수욕장","cnctrRate":"47.16"}]"""
    fun item(name: String, id: Long?, method: String) =
        SyncAttractionCongestionUseCase.Item(name, "26", "부산광역시", "해운대구", raw, oct2, oct31, id, method)

    beforeTest { clearMocks(repository) }

    Given("한 시군구의 집중률을 적재할 때") {
        Then("이은 곳·못 이은 곳을 모두 그 시군구 행으로 통째로 바꾸고, 이은 수와 지운 이전 행 수를 돌려준다") {
            val rows = slot<List<AttractionCongestion>>()
            every { repository.replaceSigungu("26350", capture(rows), any()) } returns 19

            service.replaceSigungu(
                "26350",
                listOf(item("해운대해수욕장", 501L, "EXACT"), item("SEA LIFE 부산아쿠아리움", null, "NONE")),
            ) shouldBe SyncAttractionCongestionUseCase.Applied(applied = 2, linked = 1, removed = 19)

            rows.captured.map { it.matchMethod } shouldBe listOf(CongestionMatch.EXACT, CongestionMatch.NONE)
            rows.captured.first().ratesRaw shouldBe raw
            rows.captured.all { it.signguCd == "26350" } shouldBe true
        }
        Then("빈 목록 · 같은 이름 두 번 · 모르는 방법 · 방법과 id 가 어긋난 행은 거부하고 아무것도 바꾸지 않는다") {
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", emptyList()) }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", listOf(item("a", 1L, "EXACT"), item("a", 2L, "EXACT"))) }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", listOf(item("a", 1L, "FUZZY"))) }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", listOf(item("a", null, "EXACT"))) }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("26350", listOf(item("a", 1L, "AMBIGUOUS"))) }
            shouldThrow<IllegalArgumentException> { service.replaceSigungu("2635", listOf(item("a", 1L, "EXACT"))) }
            verify(exactly = 0) { repository.replaceSigungu(any(), any(), any()) }
        }
    }
})
