package com.kgd.search.presentation.search.controller

import com.kgd.search.application.attraction.usecase.NearbyAttractionsUseCase
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
    val nearby = mockk<NearbyAttractionsUseCase>()
    val mvc = MockMvcBuilders.standaloneSetup(AttractionSearchController(search, suggest, nearby, mockk(relaxed = true)))
        .setControllerAdvice(com.kgd.common.exception.GlobalExceptionHandler())
        .build()
    val json = ObjectMapper()

    fun result(facets: SearchAttractionUseCase.AttributeFacets? = null) = SearchAttractionUseCase.Result(
        searchId = "s", attractions = emptyList(), totalElements = 0, totalPages = 0, currentPage = 0,
        attributeFacets = facets,
    )

    beforeTest { clearMocks(search) }

    given("상세 · 주변 탐색 (ADR-0105)") {
        val doc = SearchAttractionUseCase.AttractionSearchResult(
            id = "6", contentId = "126081", lang = "ko", title = "해운대해수욕장", latitude = 35.16, longitude = 129.16,
        )
        `when`("상세를 찾으면") {
            then("엣지가 1시간 쥐는 공개 캐시 헤더가 붙는다") {
                every { search.findById("6") } returns doc
                val res = mvc.perform(get("/api/search/attractions/6")).andReturn().response
                res.status shouldBe 200
                res.getHeader("Cache-Control") shouldBe "max-age=60, public, s-maxage=3600, stale-while-revalidate=600"
            }
        }
        `when`("주변을 찾으면") {
            then("네 묶음을 같은 캐시 헤더로 낸다 — 줄마다 지도·목록에 쓰는 필드만") {
                val heavy = doc.copy(imagesRaw = "[{\"originimgurl\":\"x\"}]", links = "[]", introRaw = "{}", overview = "소개")
                every { nearby.nearby("6") } returns NearbyAttractionsUseCase.Nearby(listOf(NearbyAttractionsUseCase.NearbyPlace.of(heavy)), emptyList(), emptyList(), emptyList())
                val res = mvc.perform(get("/api/search/attractions/6/nearby")).andReturn().response
                res.status shouldBe 200
                res.getHeader("Cache-Control") shouldBe "max-age=60, public, s-maxage=3600, stale-while-revalidate=600"
                val body = json.readTree(res.contentAsString)
                body["data"]["sights"][0]["id"].asText() shouldBe "6"
                val row = body["data"]["sights"][0]
                row["title"].asText() shouldBe "해운대해수욕장"
                listOf("imagesRaw", "links", "introRaw", "overview").forEach { row.has(it) shouldBe false }
            }
        }
        `when`("없는 관광지면") {
            then("404 이고 캐시 헤더를 붙이지 않는다 — 엣지가 「없음」을 쥐지 않게") {
                every { search.findById("404") } returns null
                every { nearby.nearby("404") } returns null
                for (path in listOf("/api/search/attractions/404", "/api/search/attractions/404/nearby")) {
                    val res = mvc.perform(get(path)).andReturn().response
                    res.status shouldBe 404
                    res.getHeader("Cache-Control") shouldBe null
                }
            }
        }
    }

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
    given("행사 파라미터") {
        `when`("eventStatus·sort=eventStart 를 주면") {
            then("값 그대로 질의로 묶인다 — 판정·무시는 서비스가 한다") {
                val captured = slot<SearchAttractionUseCase.Query>()
                every { search.execute(capture(captured)) } returns result()

                mvc.perform(
                    get("/api/search/attractions").param("category", "festival")
                        .param("eventStatus", "WEEKEND").param("sort", "eventStart"),
                ).andReturn()

                captured.captured.eventStatus shouldBe "WEEKEND"
                captured.captured.sort shouldBe "eventStart"
            }
        }
        `when`("결과에 행사 기간·코스 구성이 있으면") {
            then("eventStart·eventEnd 는 yyyy-MM-dd, courseStops 는 순서 목록으로 나간다") {
                val base = SearchAttractionUseCase.AttractionSearchResult(
                    id = "1", contentId = "c", lang = "ko", title = "t", latitude = 0.0, longitude = 0.0,
                )
                every { search.execute(any()) } returns result().copy(
                    attractions = listOf(
                        base.copy(eventStart = java.time.LocalDate.of(2026, 10, 1), eventEnd = java.time.LocalDate.of(2026, 10, 12)),
                        base.copy(id = "2", courseStops = listOf(SearchAttractionUseCase.CourseStop(0, "9", "경복궁", 7L))),
                    ),
                )

                val body = mvc.perform(get("/api/search/attractions")).andReturn().response.getContentAsString(Charsets.UTF_8)

                val items = json.readTree(body)["data"]["attractions"]
                items[0]["eventStart"].asString() shouldBe "2026-10-01"
                items[0]["eventEnd"].asString() shouldBe "2026-10-12"
                items[1]["courseStops"][0]["name"].asString() shouldBe "경복궁"
                items[1]["courseStops"][0]["attractionId"].asLong() shouldBe 7
            }
        }
    }
})
