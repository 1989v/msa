package com.kgd.search.presentation.search.controller

import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.databind.ObjectMapper

/** 속성 패싯 파라미터가 유스케이스 질의로 그대로 묶이고, 건수가 응답의 `attributeFacets` 로 나가는지 본다. */
class AttractionSearchControllerTest : BehaviorSpec({
    val search = mockk<SearchAttractionUseCase>()
    val suggest = mockk<SuggestAttractionUseCase>()
    val mvc = MockMvcBuilders.standaloneSetup(AttractionSearchController(search, suggest)).build()
    val json = ObjectMapper()

    fun result(facets: SearchAttractionUseCase.AttributeFacets? = null) = SearchAttractionUseCase.Result(
        searchId = "s", attractions = emptyList(), totalElements = 0, totalPages = 0, currentPage = 0,
        attributeFacets = facets,
    )

    beforeTest { clearMocks(search) }

    given("속성 패싯 파라미터") {
        `when`("전부 주면") {
            then("같은 이름의 질의 필드로 묶인다") {
                val captured = slot<SearchAttractionUseCase.Query>()
                every { search.execute(capture(captured)) } returns result()

                val status = mvc.perform(
                    get("/api/search/attractions")
                        .param("keyword", "한옥")
                        .param("openToday", "true")
                        .param("parking", "YES")
                        .param("creditCard", "YES")
                        .param("strollerRental", "YES")
                        .param("pet", "ALLOWED,PARTIAL")
                        .param("admission", "FREE")
                        .param("facets", "true"),
                ).andReturn().response.status

                status shouldBe 200
                with(captured.captured) {
                    openToday shouldBe true
                    parking shouldBe "YES"
                    creditCard shouldBe "YES"
                    strollerRental shouldBe "YES"
                    pet shouldBe "ALLOWED,PARTIAL"
                    admission shouldBe "FREE"
                    attributeFacets shouldBe true
                }
            }
        }
        `when`("하나도 주지 않으면") {
            then("고르지 않은 상태로 간다") {
                val captured = slot<SearchAttractionUseCase.Query>()
                every { search.execute(capture(captured)) } returns result()

                mvc.perform(get("/api/search/attractions").param("keyword", "한옥")).andReturn()

                captured.captured shouldBe SearchAttractionUseCase.Query(keyword = "한옥")
            }
        }
    }

    given("건수가 있는 결과") {
        `when`("응답을 받으면") {
            then("attributeFacets 아래 속성 → 값 → 건수로 나간다") {
                every { search.execute(any()) } returns result(
                    SearchAttractionUseCase.AttributeFacets(
                        openToday = 18534,
                        parking = mapOf("YES" to 31605L),
                        creditCard = mapOf("YES" to 15864L),
                        strollerRental = mapOf("YES" to 12L),
                        pet = mapOf("ALLOWED" to 9070L, "PARTIAL" to 503L),
                        admission = mapOf("FREE" to 1127L),
                    ),
                )

                val body = mvc.perform(get("/api/search/attractions")).andReturn()
                    .response.getContentAsString(Charsets.UTF_8)

                val facets = json.readTree(body)["data"]["attributeFacets"]
                facets["openToday"].asLong() shouldBe 18534
                facets["parking"]["YES"].asLong() shouldBe 31605
                facets["pet"]["PARTIAL"].asLong() shouldBe 503
                facets["admission"]["FREE"].asLong() shouldBe 1127
            }
        }
    }
})
