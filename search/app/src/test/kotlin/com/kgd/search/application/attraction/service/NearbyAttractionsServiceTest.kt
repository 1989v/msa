package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.nulls.shouldBeNull
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

/** 주변 검색 네 가지를 문서의 좌표·언어로, 상세 화면이 따로 부르던 때와 같은 조건으로 도는지 본다. */
class NearbyAttractionsServiceTest : BehaviorSpec({
    val search = mockk<SearchAttractionUseCase>()
    val service = NearbyAttractionsService(search)

    fun doc(id: String, lang: String = "ko") = SearchAttractionUseCase.AttractionSearchResult(
        id = id, contentId = "c$id", lang = lang, title = "관광지 $id", latitude = 35.16, longitude = 129.16,
    )
    fun result(vararg ids: String) = SearchAttractionUseCase.Result(
        searchId = "s", attractions = ids.map { doc(it) }, totalElements = ids.size.toLong(), totalPages = 1, currentPage = 0,
    )

    given("영문 관광지 6") {
        every { search.findById("6") } returns doc("6", lang = "en")
        val queries = mutableListOf<SearchAttractionUseCase.Query>()
        every { search.execute(capture(queries)) } answers {
            when (firstArg<SearchAttractionUseCase.Query>().category) {
                "stay" -> result("701")
                "festival" -> result("601")
                "shopping,food" -> result("401")
                else -> result("6", "301")
            }
        }

        `when`("주변을 물으면") {
            val nearby = service.nearby("6")!!

            then("네 묶음이 각자의 검색 결과다(자기 자신은 화면이 뺀다)") {
                nearby.sights.map { it.id } shouldBe listOf("6", "301")
                nearby.stays.map { it.id } shouldBe listOf("701")
                nearby.events.map { it.id } shouldBe listOf("601")
                nearby.amenities.map { it.id } shouldBe listOf("401")
            }
            then("문서의 좌표·언어로, 화면이 부르던 조건 그대로 묻는다") {
                queries.map { listOf(it.category, it.radiusKm, it.sort, it.size, it.eventStatus) } shouldContainExactlyInAnyOrder listOf(
                    listOf("nature,history,culture,leisure", 5.0, "distance", 9, null),
                    listOf("stay", 5.0, "distance", 12, null),
                    listOf("festival", 20.0, "eventStart", 12, "NOT_ENDED"),
                    listOf("shopping,food", 5.0, "distance", 60, null),
                )
                queries.forEach {
                    it.lang shouldBe "en"
                    it.lat shouldBe 35.16
                    it.lng shouldBe 129.16
                    it.attributeFacets shouldBe false
                }
            }
        }
    }

    given("없는 관광지") {
        val empty = mockk<SearchAttractionUseCase>()
        every { empty.findById("404") } returns null
        `when`("주변을 물으면") {
            then("null 이고 검색은 돌지 않는다") {
                NearbyAttractionsService(empty).nearby("404").shouldBeNull()
                verify(exactly = 0) { empty.execute(any()) }
            }
        }
    }
})
