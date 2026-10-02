package com.kgd.place.domain.attraction.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 화면에 내는 연관 대상 규칙. 값은 해운대구 202608 운영 응답(2026-10-02, place-ingest `tests/fixtures/phase2-related.json`) 모양이다 —
 * 「해운대해수욕장」 출발에 관광지 · 음식 · 숙박 대상이 순위 순으로 섞여 온다.
 */
class AttractionRelatedTest : BehaviorSpec({
    fun target(rank: Int, name: String, lcls: String, id: Long?, method: NameMatch) =
        RelatedTarget(rank, name, lcls, null, "자연경관(하천/해양)", "26350", id, method)

    fun start(id: Long?, method: NameMatch, vararg targets: RelatedTarget, baseYm: String = "202608") =
        AttractionRelated("d123", "해운대해수욕장", "26350", baseYm, "[]", id, method, targets.toList())

    Given("출발이 정확 매칭으로 이어진 관광지") {
        val row = start(
            501L, NameMatch.EXACT,
            target(4, "동백섬", "관광지", 601L, NameMatch.NORMALIZED),
            target(1, "해운대 시장", "음식", 701L, NameMatch.EXACT),
            target(10, "화로구이/마장점", "음식", null, NameMatch.NONE),
            target(11, "해운대 그랜드호텔", "숙박", 801L, NameMatch.NORMALIZED),
            target(2, "해운대해수욕장", "관광지", 502L, NameMatch.EXACT),
            target(3, "부산 해운대시장", "관광지", 603L, NameMatch.CONTAINS),
            target(5, "더베이101", "관광지", 501L, NameMatch.EXACT),
            target(6, "누리마루 APEC하우스", "관광지", 604L, NameMatch.EXACT),
            target(7, "누리마루APEC 하우스", "관광지", 604L, NameMatch.NORMALIZED),
            target(8, "청사포", "관광지", null, NameMatch.AMBIGUOUS),
            target(9, "해운대 해수욕장", "관광지", 605L, NameMatch.EXACT),
        )
        Then("우리 행으로 정확·정규화로 이어진 대상만 순위 순으로 — 분류(음식·숙박)와 무관, 못 이음 · 포함 · 모호 · 자기 자신 · 같은 이름 · 겹친 관광지는 뺀다") {
            row.servedTargets().map { it.rank to it.attractionId } shouldBe listOf(1 to 701L, 4 to 601L, 6 to 604L, 11 to 801L)
        }
    }

    Given("출발이 포함 매칭이거나 못 이은 경우") {
        Then("대상이 이어져 있어도 아무것도 내지 않는다 — 출발 관광지가 틀리면 남의 상세에 목록이 붙는다") {
            start(501L, NameMatch.CONTAINS, target(1, "동백섬", "관광지", 601L, NameMatch.EXACT)).servedTargets() shouldBe emptyList()
            start(null, NameMatch.NONE, target(1, "동백섬", "관광지", 601L, NameMatch.EXACT)).servedTargets() shouldBe emptyList()
        }
    }

    Given("원천 이름 둘이 한 관광지에 이어졌을 때") {
        Then("정확 매칭 쪽, 같으면 더 최근 달을 고른다") {
            val exact = start(501L, NameMatch.EXACT, baseYm = "202607")
            val normalized = start(501L, NameMatch.NORMALIZED, baseYm = "202608")
            val newer = start(501L, NameMatch.EXACT, baseYm = "202608")
            AttractionRelated.preferred(listOf(normalized, exact))[501L] shouldBe exact
            AttractionRelated.preferred(listOf(exact, newer, normalized))[501L] shouldBe newer
        }
    }

    Given("앞뒤가 맞지 않는 행") {
        Then("거부한다") {
            shouldThrow<IllegalArgumentException> { start(null, NameMatch.EXACT) }
            shouldThrow<IllegalArgumentException> { start(501L, NameMatch.EXACT, baseYm = "202613") }
            shouldThrow<IllegalArgumentException> { start(501L, NameMatch.EXACT, target(1, "a", "관광지", null, NameMatch.NONE), target(1, "b", "관광지", null, NameMatch.NONE)) }
            shouldThrow<IllegalArgumentException> { target(1, "a", "관광지", 1L, NameMatch.AMBIGUOUS) }
            shouldThrow<IllegalArgumentException> { target(0, "a", "관광지", null, NameMatch.NONE) }
        }
    }
})
