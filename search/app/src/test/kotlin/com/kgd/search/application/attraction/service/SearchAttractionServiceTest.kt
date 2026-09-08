package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.QueryIntent
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.springframework.data.domain.PageImpl

class SearchAttractionServiceTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val resolveQueryVector = mockk<ResolveQueryVectorUseCase>(relaxed = true)

    /** 기본은 하이브리드 꺼짐 — 운영 기본값과 같다. 켠 경우는 아래 given 블록이 따로 만든다. */
    /** 분류 사전은 기본적으로 비워 둔다 — 사전 없이도 검색이 성립해야 한다(place 장애 시 모습). */
    fun serviceWith(
        hybridEnabled: Boolean = false,
        modelRef: String = MODEL_REF,
        lexicon: QueryIntent.Lexicon = QueryIntent.Lexicon.EMPTY,
    ) = SearchAttractionService(
        searchPort, resolveQueryVector,
        object : CategoryLexiconPort {
            override fun lexicon(lang: String?) = lexicon
        },
        AttractionHybridProperties(enabled = hybridEnabled),
        QueryVectorProperties(modelRef = modelRef),
        SimpleMeterRegistry(),
    )
    val service = serviceWith()

    // 스펙 안에서 목을 공유하므로 매 테스트마다 지운다 — 안 지우면 `verify(exactly = 0)` 이
    // 앞 테스트의 호출까지 세어 엉뚱하게 실패한다.
    beforeTest { clearMocks(searchPort, resolveQueryVector) }

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

    given("하이브리드가 켜져 있을 때") {
        `when`("사전이 질의를 알면") {
            then("벡터가 포트로 넘어가야 한다 — 벡터 레그를 켜는 것이 이 필드다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())
                every { resolveQueryVector.resolve("한옥", MODEL_REF) } returns listOf(0.6f, 0.8f)

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = "한옥"))

                captured.captured.embedding shouldBe listOf(0.6f, 0.8f)
            }
        }

        `when`("사전이 모르는 질의면") {
            then("벡터 없이 넘겨야 한다 — 미적중은 BM25 경로다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())
                every { resolveQueryVector.resolve(any(), any()) } returns null

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = "처음 보는 말"))

                captured.captured.embedding shouldBe null
            }
        }

        `when`("거리순 정렬이면") {
            then("사전을 보지도 않아야 한다 — 정렬이 점수를 무시해 얻는 것이 없다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                serviceWith(hybridEnabled = true).execute(
                    SearchAttractionUseCase.Query(keyword = "한옥", lat = 37.5, lng = 127.0, sort = "distance"),
                )

                captured.captured.embedding shouldBe null
                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }

        `when`("키워드가 없으면(목록 탐색)") {
            then("사전을 보지 않아야 한다 — 벡터로 비길 질의가 없다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = " "))

                captured.captured.embedding shouldBe null
                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }

        `when`("스탬프가 비어 있으면") {
            then("켜져 있어도 사전을 보지 않아야 한다 — 첫 채움 전 정상 상태다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                serviceWith(hybridEnabled = true, modelRef = "").execute(SearchAttractionUseCase.Query(keyword = "한옥"))

                captured.captured.embedding shouldBe null
                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }
    }

    given("질의에 의도어가 섞여 있을 때") {
        val lexicon = QueryIntent.Lexicon.of(listOf(Triple("NA020100", 3, "해수욕장")))

        `when`("「아이와 갈만한 관광지」로 검색하면") {
            then("의도어는 필터가 되고 검색어에서 빠진다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                serviceWith(lexicon = lexicon)
                    .execute(SearchAttractionUseCase.Query(keyword = "아이와 갈만한 관광지"))

                captured.captured.contentTypeId shouldBe "12"
                captured.captured.keyword shouldBe "아이와"
            }
        }

        `when`("분류 이름만 치면") {
            then("검색어 없이 분류 필터만 남는다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns PageImpl(emptyList())

                serviceWith(lexicon = lexicon)
                    .execute(SearchAttractionUseCase.Query(keyword = "해수욕장"))

                captured.captured.lclsCode shouldBe "NA020100"
                captured.captured.lclsDepth shouldBe 3
                captured.captured.keyword shouldBe null
            }
        }

        `when`("벡터 레그에 넘길 질의는") {
            then("잔여가 아니라 **원문**이어야 한다 — 문장의 뜻이 벡터의 전부다") {
                every { searchPort.search(any(), any()) } returns PageImpl(emptyList())
                every { resolveQueryVector.resolve(any(), any()) } returns listOf(0.1f, 0.2f)

                serviceWith(hybridEnabled = true, lexicon = lexicon)
                    .execute(SearchAttractionUseCase.Query(keyword = "아이와 갈만한 관광지"))

                verify { resolveQueryVector.resolve("아이와 갈만한 관광지", MODEL_REF) }
            }
        }
    }

    given("검색어 없는 목록 조회") {
        `when`("빈 키워드로 부르면") {
            then("사전도 인코더도 보지 않는다") {
                every { searchPort.search(any(), any()) } returns PageImpl(emptyList())

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = ""))

                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }
    }

    given("하이브리드가 꺼져 있을 때") {
        `when`("키워드 검색을 하면") {
            then("사전을 보지 않아야 한다") {
                every { searchPort.search(any(), any()) } returns PageImpl(emptyList())

                service.execute(SearchAttractionUseCase.Query(keyword = "한옥"))

                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }
    }
})

private const val MODEL_REF = "microsoft/harrier-oss-v1-270m@abc1234#d640"
