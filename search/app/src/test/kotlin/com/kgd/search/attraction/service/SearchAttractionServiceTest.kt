package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.data.domain.PageImpl

class SearchAttractionServiceTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val service = SearchAttractionService(searchPort)

    fun document(id: String = "1", overview: String? = null) = AttractionDocument(
        id = id, contentId = "126508", lang = "ko", title = "경복궁",
        latitude = 37.5788, longitude = 126.977, category = "history", overview = overview,
    )

    given("관광지 검색 시") {
        `when`("lat/lng/radiusKm 와 sort=distance 가 주어지면") {
            then("geo 필터가 거리순 정렬로 포트에 전달되어야 한다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns
                    PageImpl(listOf(AttractionSearchPort.AttractionHit(document(), 1.0, distanceKm = 0.4)))

                val result = service.execute(
                    SearchAttractionUseCase.Query(
                        keyword = "궁궐", lang = "ko",
                        lat = 37.57, lng = 126.97, radiusKm = 5.0, sort = "distance",
                    )
                )

                captured.captured.geo shouldNotBe null
                captured.captured.geo!!.sortByDistance shouldBe true
                result.attractions.first().distanceKm shouldBe 0.4
                result.searchId shouldNotBe ""
            }
        }
        `when`("radiusKm 가 범위를 벗어나면") {
            then("0.1~50 으로 보정되어야 한다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                service.execute(SearchAttractionUseCase.Query(lat = 37.0, lng = 127.0, radiusKm = 500.0))

                captured.captured.geo!!.radiusKm shouldBe 50.0
            }
        }
        `when`("빈 keyword 가 주어지면") {
            then("keyword 없이(필터-only) 포트에 전달되어야 한다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                service.execute(SearchAttractionUseCase.Query(keyword = " ", lang = "en"))

                captured.captured.keyword shouldBe null
                captured.captured.lang shouldBe "en"
            }
        }
        `when`("overview 가 200자를 넘으면") {
            then("목록 응답에서 요약되어야 한다") {
                every { searchPort.search(any(), any()) } returns PageImpl(
                    listOf(AttractionSearchPort.AttractionHit(document(overview = "가".repeat(300)), 1.0))
                )

                val result = service.execute(SearchAttractionUseCase.Query(keyword = "경복궁"))
                result.attractions.first().overview!!.length shouldBe 201
            }
        }
    }

    given("통합 자동완성 시") {
        `when`("지역과 관광지가 섞여 반환되면") {
            then("타입·좌표·레벨이 보존되어야 한다") {
                every { searchPort.suggest("서울", "ko", 8) } returns listOf(
                    com.kgd.search.domain.attraction.model.SuggestHit(
                        type = com.kgd.search.domain.attraction.model.SuggestHit.Type.REGION,
                        id = "10", title = "서울특별시", latitude = 37.56, longitude = 126.99, regionLevel = "CITY",
                    ),
                    com.kgd.search.domain.attraction.model.SuggestHit(
                        type = com.kgd.search.domain.attraction.model.SuggestHit.Type.ATTRACTION,
                        id = "1", title = "경복궁", latitude = 37.58, longitude = 126.98, category = "history",
                    ),
                )
                val result = service.execute("서울", "ko", 8)
                result.size shouldBe 2
                result[0].type shouldBe "REGION"
                result[0].regionLevel shouldBe "CITY"
                result[1].category shouldBe "history"
            }
        }
    }

    given("관광지 단건 조회 시") {
        `when`("존재하지 않는 id 면") {
            then("null 을 반환해야 한다") {
                every { searchPort.findById("999") } returns null
                service.findById("999") shouldBe null
            }
        }
        `when`("존재하는 id 면") {
            then("overview 전문을 그대로 반환해야 한다") {
                every { searchPort.findById("1") } returns document(overview = "가".repeat(300))
                service.findById("1")!!.overview!!.length shouldBe 300
            }
        }
    }
})
