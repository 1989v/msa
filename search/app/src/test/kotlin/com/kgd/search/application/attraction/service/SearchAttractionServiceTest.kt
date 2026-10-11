package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.usecase.CategoryLexiconUseCase
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionSignalSort
import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttractionAttributes
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.AttributeFacetCounts
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.CourseStop
import com.kgd.search.domain.attraction.model.EventDateRange
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.RegularClosure
import com.kgd.search.domain.query.model.QueryIntent
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
import java.time.Clock
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset

class SearchAttractionServiceTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val resolveQueryVector = mockk<ResolveQueryVectorUseCase>(relaxed = true)

    /** 기본은 하이브리드 꺼짐 — 운영 기본값과 같다. 켠 경우는 아래 given 블록이 따로 만든다. */
    /** 분류 사전은 기본적으로 비워 둔다 — 사전 없이도 검색이 성립해야 한다(place 장애 시 모습). */
    fun serviceWith(
        hybridEnabled: Boolean = false,
        modelRef: String = MODEL_REF,
        lexicon: QueryIntent.Lexicon = QueryIntent.Lexicon.EMPTY,
        clock: Clock = Clock.systemUTC(),
    ) = SearchAttractionService(
        searchPort, resolveQueryVector,
        object : CategoryLexiconUseCase {
            override fun lexicon(lang: String?) = lexicon
        },
        AttractionHybridProperties(enabled = hybridEnabled),
        QueryVectorProperties(modelRef = modelRef),
        SimpleMeterRegistry(),
        clock,
    )
    val service = serviceWith()

    // 스펙 안에서 목을 공유하므로 매 테스트마다 지운다 — 안 지우면 `verify(exactly = 0)` 이
    // 앞 테스트의 호출까지 세어 엉뚱하게 실패한다.
    beforeTest {
        clearMocks(searchPort, resolveQueryVector)
        // 기본은 고칠 오타 없음 — 교정을 보는 테스트만 따로 답을 준다
        every { searchPort.correct(any(), any()) } returns null
    }

    fun found(hits: List<AttractionSearchPort.AttractionHit>) = AttractionSearchPort.SearchResult(PageImpl(hits))

    fun document(id: String = "1", overview: String? = null) = AttractionDocument(
        id = id, contentId = "126508", lang = "ko", title = "경복궁",
        latitude = 37.5788, longitude = 126.977, category = "history", overview = overview,
    )

    given("오타 교정") {
        `when`("포트가 고친 검색어를 돌려주면") {
            then("고친 검색어로 찾고 응답에 알린다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.correct("경복굼 야경", "ko") } returns "경복궁 야경"
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                val result = service.execute(SearchAttractionUseCase.Query(keyword = "경복굼 야경", lang = "ko"))

                captured.captured.keyword shouldBe "경복궁 야경"
                result.correctedKeyword shouldBe "경복궁 야경"
            }
        }
        `when`("고칠 것이 없으면") {
            then("원문으로 찾고 교정 표시는 비운다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                val result = service.execute(SearchAttractionUseCase.Query(keyword = "해운대", lang = "ko"))

                captured.captured.keyword shouldBe "해운대"
                result.correctedKeyword shouldBe null
            }
        }
        `when`("검색어가 없으면") {
            then("교정을 부르지 않는다") {
                every { searchPort.search(any(), any()) } returns found(emptyList())

                service.execute(SearchAttractionUseCase.Query(lat = 37.0, lng = 127.0))

                verify(exactly = 0) { searchPort.correct(any(), any()) }
            }
        }
        `when`("exact=true 로 원래 검색어 검색을 요청하면") {
            then("교정을 부르지 않고 원문으로 찾으며 교정 표시는 비운다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.correct("경복굼 야경", "ko") } returns "경복궁 야경"
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                val result = service.execute(SearchAttractionUseCase.Query(keyword = "경복굼 야경", lang = "ko", exact = true))

                verify(exactly = 0) { searchPort.correct(any(), any()) }
                captured.captured.keyword shouldBe "경복굼 야경"
                result.correctedKeyword shouldBe null
            }
        }
    }

    given("관광지 검색 시") {
        `when`("lat/lng/radiusKm 와 sort=distance 가 주어지면") {
            then("geo 필터가 거리순 정렬로 포트에 전달되어야 한다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns
                    found(listOf(AttractionSearchPort.AttractionHit(document(), 1.0, distanceKm = 0.4)))

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
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                service.execute(SearchAttractionUseCase.Query(lat = 37.0, lng = 127.0, radiusKm = 500.0))

                captured.captured.geo!!.radiusKm shouldBe 50.0
            }
        }
        `when`("빈 keyword 가 주어지면") {
            then("keyword 없이(필터-only) 포트에 전달되어야 한다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                service.execute(SearchAttractionUseCase.Query(keyword = " ", lang = "en"))

                captured.captured.keyword shouldBe null
                captured.captured.lang shouldBe "en"
            }
        }
        `when`("overview 가 200자를 넘으면") {
            then("목록 응답에서 요약되어야 한다") {
                every { searchPort.search(any(), any()) } returns found(
                    listOf(AttractionSearchPort.AttractionHit(document(overview = "가".repeat(300)), 1.0))
                )

                val result = service.execute(SearchAttractionUseCase.Query(keyword = "경복궁"))
                result.attractions.first().overview!!.length shouldBe 201
            }
        }
        // 요약은 원문을 평문화한 뒤 자른다 — 거꾸로면 잘린 엔티티·태그 조각이 카드에 그대로 보인다
        `when`("엔티티·태그가 200자 경계에 걸친 원문이면") {
            then("정규화한 뒤 200자에서 자른다") {
                val raw = "가".repeat(198) + "&rsquo;<b>나다</b>" + "라".repeat(20)
                every { searchPort.search(any(), any()) } returns found(
                    listOf(AttractionSearchPort.AttractionHit(document(overview = raw), 1.0))
                )

                service.execute(SearchAttractionUseCase.Query(keyword = "경복궁")).attractions.first().overview shouldBe
                    "가".repeat(198) + "’나" + "…"
            }
        }
        `when`("원문 250자가 정규화로 150자가 되면") {
            then("… 없이 정규화 결과 그대로다 — 길이는 원문이 아니라 정규화 결과로 잰다") {
                val raw = "<span class=\"" + "x".repeat(78) + "\">" + "가".repeat(150) + "</span>"
                raw.length shouldBe 250
                every { searchPort.search(any(), any()) } returns found(
                    listOf(AttractionSearchPort.AttractionHit(document(overview = raw), 1.0))
                )

                service.execute(SearchAttractionUseCase.Query(keyword = "경복궁")).attractions.first().overview shouldBe
                    "가".repeat(150)
            }
        }
        `when`("정규화하면 비는 원문이면") {
            then("null 이다") {
                every { searchPort.search(any(), any()) } returns found(
                    listOf(AttractionSearchPort.AttractionHit(document(overview = "<p><br /></p>&nbsp;"), 1.0))
                )

                service.execute(SearchAttractionUseCase.Query(keyword = "경복궁")).attractions.first().overview shouldBe null
            }
        }
        `when`("원문에 이스케이프된 꺾쇠(&lt;PARASITE&gt;)가 있으면") {
            then("한 번만 정규화해 <PARASITE> 가 글자로 남는다") {
                every { searchPort.search(any(), any()) } returns found(
                    listOf(AttractionSearchPort.AttractionHit(document(overview = "K-movie &lt;PARASITE&gt; - 촬영지"), 1.0))
                )

                service.execute(SearchAttractionUseCase.Query(keyword = "경복궁")).attractions.first().overview shouldBe
                    "K-movie <PARASITE> - 촬영지"
            }
        }
        `when`("문서에 비슷한 곳 목록이 있어도") {
            then("목록 응답에는 싣지 않는다 — 단건 조회 전용이다") {
                every { searchPort.search(any(), any()) } returns found(
                    listOf(
                        AttractionSearchPort.AttractionHit(
                            document().copy(similarElsewhere = listOf(com.kgd.search.domain.attraction.model.SimilarPlace("9", "경기전", null, null))),
                            1.0,
                        ),
                    ),
                )

                service.execute(SearchAttractionUseCase.Query(keyword = "경복궁")).attractions.first().similarElsewhere shouldBe null
            }
        }
    }

    given("14일 고유 클릭 방문자 수가 색인된 문서") {
        `when`("목록으로 검색하면") {
            then("싣지 않는다 — 상세 배지 전용이다") {
                every { searchPort.search(any(), any()) } returns found(
                    listOf(AttractionSearchPort.AttractionHit(document().copy(uniqueClickers14d = 12), 1.0)),
                )
                service.execute(SearchAttractionUseCase.Query(keyword = "경복궁")).attractions.first().uniqueClickers14d shouldBe null
            }
        }
        `when`("단건 조회하면") {
            then("값을 그대로 싣는다 — 배지 기준은 화면이 같은 상수로 판단한다") {
                every { searchPort.findById("1") } returns document().copy(uniqueClickers14d = 12)
                service.findById("1")!!.uniqueClickers14d shouldBe 12
            }
        }
    }

    given("통합 자동완성 시") {
        `when`("지역과 관광지가 섞여 반환되면") {
            then("타입·좌표·레벨이 보존되어야 한다") {
                every { searchPort.suggest("서울", "ko", 8, any()) } returns listOf(
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
        `when`("원문 overview 에 엔티티가 있으면") {
            then("정규화하지 않고 원문 그대로 돌려준다 — 상세는 표시 시점에 정규화한다") {
                every { searchPort.findById("1") } returns document(overview = "K-movie &lt;PARASITE&gt; - 촬영지")
                service.findById("1")!!.overview shouldBe "K-movie &lt;PARASITE&gt; - 촬영지"
            }
        }
        `when`("출처·공공누리 유형·요금 텍스트·반려동물 원문이 색인된 문서면") {
            then("네 값을 결과에 그대로 싣는다 — 요금 텍스트는 이미 평문이라 다시 정규화하지 않는다") {
                every { searchPort.findById("1") } returns document().copy(
                    source = "TOURAPI", copyrightDivCd = "Type1", feeText = "<어린이> 무료", petAcmpyType = "전구역 동반가능",
                )
                val r = service.findById("1")!!
                r.source shouldBe "TOURAPI"
                r.copyrightDivCd shouldBe "Type1"
                r.feeText shouldBe "<어린이> 무료"
                r.petAcmpyType shouldBe "전구역 동반가능"
            }
        }
        // 목록 응답도 싣는다 — 정적 sitemap 이 목록으로 상대 언어 항목을 잇고, 최근 갱신 순이 본문 변경 시각을 읽는다
        `when`("언어 대체 짝·본문 변경 시각이 색인된 문서면") {
            val indexed = document().copy(alternateId = "2180", contentUpdatedAt = LocalDateTime.of(2026, 10, 8, 9, 10, 11))
            then("단건 결과에 두 값을 그대로 싣는다") {
                every { searchPort.findById("1") } returns indexed
                val r = service.findById("1")!!
                r.alternateId shouldBe "2180"
                r.contentUpdatedAt shouldBe LocalDateTime.of(2026, 10, 8, 9, 10, 11)
            }
            then("목록 결과에도 두 값을 싣는다") {
                every { searchPort.search(any(), any()) } returns found(listOf(AttractionSearchPort.AttractionHit(indexed, 1.0)))
                val r = service.execute(SearchAttractionUseCase.Query(keyword = "")).attractions.single()
                r.alternateId shouldBe "2180"
                r.contentUpdatedAt shouldBe LocalDateTime.of(2026, 10, 8, 9, 10, 11)
            }
            then("짝이 없는 문서는 null 이다") {
                every { searchPort.findById("1") } returns document()
                service.findById("1")!!.alternateId shouldBe null
            }
        }
        // 화면 JSON-LD 가 이 필드로 영업 요일·무료 여부를 만든다 — 빠지면 하이드레이션이 서버 렌더의 값을 지운다
        `when`("속성·지역이 색인된 문서면") {
            then("색인 표기 그대로의 속성과 지역 안 위치를 싣는다") {
                every { searchPort.findById("1") } returns document().copy(
                    ldongRegnCd = "11", ldongSignguCd = "110", contentTypeId = "12",
                    attributes = AttractionAttributes(
                        regularClosure = RegularClosure.Weekly(setOf(java.time.DayOfWeek.MONDAY)),
                        parking = Availability.YES, petPolicy = PetPolicy.PARTIAL,
                        creditCard = Availability.UNKNOWN, strollerRental = Availability.NO,
                        freeAdmission = Admission.FREE,
                    ),
                    region = AttractionRegion(
                        sigunguName = "종로구", typeCount = 40, categoryCount = 6, categoryName = "고궁",
                        sameCategoryNearby = listOf(NearbyPlace("2", "창덕궁", 1200, null)),
                    ),
                    similarElsewhere = listOf(com.kgd.search.domain.attraction.model.SimilarPlace("9", "경기전", "전북특별자치도", null)),
                )
                val r = service.findById("1")!!
                r.similarElsewhere!!.single() shouldBe SearchAttractionUseCase.Similar("9", "경기전", "전북특별자치도", null)
                r.closureState shouldBe "WEEKLY"
                r.closedWeekdays shouldBe listOf("MON")
                r.attrParking shouldBe "YES"
                r.petPolicy shouldBe "PARTIAL"
                r.attrCreditCard shouldBe "UNKNOWN"
                r.attrAdmission shouldBe "FREE"
                r.contentTypeId shouldBe "12"
                r.region!!.ldongSignguCd shouldBe "110"
                r.region!!.categoryCount shouldBe 6
                r.region!!.sameCategoryNearby.single().title shouldBe "창덕궁"
            }
        }
    }

    given("하이브리드가 켜져 있을 때") {
        `when`("사전이 질의를 알면") {
            then("벡터가 포트로 넘어가야 한다 — 벡터 레그를 켜는 것이 이 필드다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())
                every { resolveQueryVector.resolve("한옥", MODEL_REF) } returns listOf(0.6f, 0.8f)

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = "한옥"))

                captured.captured.embedding shouldBe listOf(0.6f, 0.8f)
            }
        }

        `when`("사전이 모르는 질의면") {
            then("벡터 없이 넘겨야 한다 — 미적중은 BM25 경로다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())
                every { resolveQueryVector.resolve(any(), any()) } returns null

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = "처음 보는 말"))

                captured.captured.embedding shouldBe null
            }
        }

        `when`("거리순 정렬이면") {
            then("사전을 보지도 않아야 한다 — 정렬이 점수를 무시해 얻는 것이 없다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

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
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = " "))

                captured.captured.embedding shouldBe null
                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }

        `when`("스탬프가 비어 있으면") {
            then("켜져 있어도 사전을 보지 않아야 한다 — 첫 채움 전 정상 상태다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

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
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                serviceWith(lexicon = lexicon)
                    .execute(SearchAttractionUseCase.Query(keyword = "아이와 갈만한 관광지"))

                captured.captured.facets shouldBe mapOf("contentTypeId" to "12")
                captured.captured.keyword shouldBe "아이와"
            }
        }

        `when`("분류 이름만 치면") {
            then("검색어 없이 분류 필터만 남는다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                serviceWith(lexicon = lexicon)
                    .execute(SearchAttractionUseCase.Query(keyword = "해수욕장"))

                captured.captured.facets shouldBe mapOf("lclsSystm3" to "NA020100")
                captured.captured.keyword shouldBe null
            }
        }

        `when`("벡터 레그에 넘길 질의는") {
            then("잔여가 아니라 **원문**이어야 한다 — 문장의 뜻이 벡터의 전부다") {
                every { searchPort.search(any(), any()) } returns found(emptyList())
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
                every { searchPort.search(any(), any()) } returns found(emptyList())

                serviceWith(hybridEnabled = true).execute(SearchAttractionUseCase.Query(keyword = ""))

                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }
    }

    given("「오늘 정기휴무 아님」의 오늘") {
        // 파드는 UTC 다. KST 로 세지 않으면 한국 월요일 00:00~08:59 가 일요일로 잡힌다.
        fun todayAt(instant: String): DayOfWeek {
            val captured = slot<AttractionSearchPort.SearchQuery>()
            every { searchPort.search(capture(captured), any()) } returns found(emptyList())
            serviceWith(clock = Clock.fixed(Instant.parse(instant), ZoneOffset.UTC))
                .execute(SearchAttractionUseCase.Query(openToday = true))
            return captured.captured.attributes!!.today
        }
        `when`("KST 일요일 23:59 (UTC 14:59)") {
            then("일요일이다") { todayAt("2026-10-04T14:59:00Z") shouldBe DayOfWeek.SUNDAY }
        }
        `when`("KST 월요일 00:00 (UTC 로는 아직 일요일 15:00)") {
            then("월요일이다") { todayAt("2026-10-04T15:00:00Z") shouldBe DayOfWeek.MONDAY }
        }
    }

    given("속성 패싯 건수 요청 여부") {
        `when`("facets 를 주지 않으면") {
            then("세지 않는다 — 선택(빈 선택)은 그대로 넘긴다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                service.execute(SearchAttractionUseCase.Query(parking = "YES"))

                captured.captured.countAttributeFacets shouldBe false
                captured.captured.attributes!!.parking shouldBe true
            }
        }
        `when`("facets=true 면") {
            then("아무것도 고르지 않아도 센다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                service.execute(SearchAttractionUseCase.Query(attributeFacets = true))

                captured.captured.countAttributeFacets shouldBe true
                captured.captured.attributes shouldBe AttributeSelection(today = captured.captured.attributes!!.today)
            }
        }
    }

    given("속성 패싯 파라미터") {
        `when`("긍정 값을 주면") {
            then("선택이 되어 포트에 간다 — 반려동물은 쉼표로 둘 다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                service.execute(
                    SearchAttractionUseCase.Query(
                        openToday = true, parking = "YES", creditCard = "YES", strollerRental = "YES",
                        pet = "ALLOWED, PARTIAL", admission = "FREE",
                    ),
                )

                val selection = captured.captured.attributes!!
                selection.openToday shouldBe true
                selection.parking shouldBe true
                selection.creditCard shouldBe true
                selection.strollerRental shouldBe true
                selection.pet shouldBe setOf(PetPolicy.ALLOWED, PetPolicy.PARTIAL)
                selection.freeAdmission shouldBe true
            }
            then("무장애는 연 코드만 쉼표로 받고, 웰니스는 참일 때만 선택이 된다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                // PARKING 은 원천 코드지만 필터로 열지 않았다 — 버린다
                service.execute(SearchAttractionUseCase.Query(barrierFree = "WHEELCHAIR, PARKING,RESTROOM,foo", wellness = true))

                captured.captured.attributes!!.barrierFree shouldBe setOf("WHEELCHAIR", "RESTROOM")
                captured.captured.attributes!!.wellness shouldBe true
            }
        }
        `when`("부정·UNKNOWN·모르는 값을 주면") {
            then("오류 없이 무시하고 그 속성은 거르지 않는다") {
                val captured = slot<AttractionSearchPort.SearchQuery>()
                every { searchPort.search(capture(captured), any()) } returns found(emptyList())

                service.execute(
                    SearchAttractionUseCase.Query(
                        parking = "NO", creditCard = "UNKNOWN", strollerRental = "yes",
                        pet = "UNKNOWN,foo", admission = "PAID",
                    ),
                )

                captured.captured.attributes shouldBe AttributeSelection(today = captured.captured.attributes!!.today)
            }
        }
        `when`("포트가 건수를 주면") {
            then("파라미터 값과 같은 표기를 키로 응답에 싣는다") {
                every { searchPort.search(any(), any()) } returns AttractionSearchPort.SearchResult(
                    PageImpl(emptyList()),
                    AttributeFacetCounts(
                        openToday = 18534, parking = 31605, creditCard = 15864, strollerRental = 12,
                        pet = mapOf(PetPolicy.ALLOWED to 9070L, PetPolicy.PARTIAL to 503L), freeAdmission = 1127,
                    ),
                )

                val facets = service.execute(SearchAttractionUseCase.Query()).attributeFacets!!

                facets.openToday shouldBe 18534
                facets.parking shouldBe mapOf("YES" to 31605L)
                facets.creditCard shouldBe mapOf("YES" to 15864L)
                facets.strollerRental shouldBe mapOf("YES" to 12L)
                facets.pet shouldBe mapOf("ALLOWED" to 9070L, "PARTIAL" to 503L)
                facets.admission shouldBe mapOf("FREE" to 1127L)
            }
        }
        `when`("포트가 건수 없이 결과만 주면") {
            then("결과는 그대로, 건수는 null") {
                every { searchPort.search(any(), any()) } returns
                    found(listOf(AttractionSearchPort.AttractionHit(document(), 1.0)))

                val result = service.execute(SearchAttractionUseCase.Query(parking = "YES"))

                result.attractions.size shouldBe 1
                result.attributeFacets shouldBe null
            }
        }
    }

    given("하이브리드가 꺼져 있을 때") {
        `when`("키워드 검색을 하면") {
            then("사전을 보지 않아야 한다") {
                every { searchPort.search(any(), any()) } returns found(emptyList())

                service.execute(SearchAttractionUseCase.Query(keyword = "한옥"))

                verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
            }
        }
    }
    given("찜순·클릭순 정렬") {
        fun sentQuery(query: SearchAttractionUseCase.Query, hybridEnabled: Boolean = false): AttractionSearchPort.SearchQuery {
            val captured = slot<AttractionSearchPort.SearchQuery>()
            every { searchPort.search(capture(captured), any()) } returns found(emptyList())
            serviceWith(hybridEnabled = hybridEnabled).execute(query)
            return captured.captured
        }

        then("sort=saved·clicked 는 하한을 실은 근거 정렬을 넘긴다 — 하한은 찜 3명·클릭 5명") {
            sentQuery(SearchAttractionUseCase.Query(sort = "saved")).signalSort shouldBe AttractionSignalSort.SAVED
            sentQuery(SearchAttractionUseCase.Query(sort = "clicked")).signalSort shouldBe AttractionSignalSort.CLICKED
            AttractionSignalSort.SAVED.min shouldBe 3
            AttractionSignalSort.CLICKED.min shouldBe 5
        }
        then("키워드가 있고 하이브리드가 켜져 있어도 벡터를 만들지 않는다 — 하이브리드 경로를 타지 않는다") {
            every { resolveQueryVector.resolve(any(), any()) } returns listOf(0.6f, 0.8f)
            listOf("saved", "clicked").forEach { sort ->
                sentQuery(SearchAttractionUseCase.Query(keyword = "한옥", sort = sort), hybridEnabled = true).embedding shouldBe null
            }
            verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
        }
        then("다른 정렬·모르는 값은 근거 정렬이 아니다") {
            listOf("relevance", "eventStart", "distance", "SAVED", "").forEach { sort ->
                (sort to sentQuery(SearchAttractionUseCase.Query(sort = sort)).signalSort) shouldBe (sort to null)
            }
        }
        then("목록 결과에도 찜 수와 기준일이 실린다 — 「많이 찜한 곳」 카드가 쓴다") {
            every { searchPort.search(any(), any()) } returns found(
                listOf(
                    AttractionSearchPort.AttractionHit(
                        document().copy(savedCount = 4, signalsAsOf = LocalDate.of(2026, 10, 11)),
                        score = 1.0,
                    ),
                ),
            )
            val item = serviceWith().execute(SearchAttractionUseCase.Query(sort = "saved")).attractions.single()
            item.savedCount shouldBe 4
            item.signalsAsOf shouldBe LocalDate.of(2026, 10, 11)
        }
    }

    given("행사 필터·정렬 — 고정 시계 2026-10-02T15:30Z (KST 10-03 토요일 00:30)") {
        val kstSaturday = Clock.fixed(Instant.parse("2026-10-02T15:30:00Z"), ZoneOffset.UTC)

        fun sentQuery(query: SearchAttractionUseCase.Query, hybridEnabled: Boolean = false): AttractionSearchPort.SearchQuery {
            val captured = slot<AttractionSearchPort.SearchQuery>()
            every { searchPort.search(capture(captured), any()) } returns found(emptyList())
            serviceWith(hybridEnabled = hybridEnabled, clock = kstSaturday).execute(query)
            return captured.captured
        }

        then("NOT_ENDED 는 KST 오늘(UTC 날짜가 아니라 10-03)부터 끝나지 않은 범위를 넘긴다") {
            sentQuery(SearchAttractionUseCase.Query(eventStatus = "NOT_ENDED")).eventRange shouldBe
                EventDateRange(startGte = null, startLte = null, endGte = LocalDate.of(2026, 10, 3))
        }
        then("WEEKEND 는 토요일 당일이면 [토, 일] 과 겹치는 범위를 넘긴다") {
            sentQuery(SearchAttractionUseCase.Query(eventStatus = "WEEKEND")).eventRange shouldBe
                EventDateRange(startGte = null, startLte = LocalDate.of(2026, 10, 4), endGte = LocalDate.of(2026, 10, 3))
        }
        then("모르는 값·소문자·빈 값·없음은 조건 없이 간다") {
            listOf("FOO", "ongoing", "", null).forEach { value ->
                sentQuery(SearchAttractionUseCase.Query(eventStatus = value)).eventRange shouldBe null
            }
        }
        then("sort=eventStart 면 시작일 정렬을 넘기고 하이브리드가 켜져 있어도 벡터를 만들지 않는다") {
            every { resolveQueryVector.resolve(any(), any()) } returns listOf(0.6f, 0.8f)

            val sent = sentQuery(
                SearchAttractionUseCase.Query(keyword = "축제", eventStatus = "NOT_ENDED", sort = "eventStart"),
                hybridEnabled = true,
            )

            sent.sortByEventStart shouldBe true
            sent.embedding shouldBe null
            verify(exactly = 0) { resolveQueryVector.resolve(any(), any()) }
        }
        then("다른 정렬은 시작일 정렬이 아니다") {
            sentQuery(SearchAttractionUseCase.Query(sort = "relevance")).sortByEventStart shouldBe false
        }
        then("자동완성은 늘 KST 오늘 기준 NOT_ENDED 범위를 넘긴다") {
            val range = slot<EventDateRange>()
            every { searchPort.suggest("머드", "ko", 8, capture(range)) } returns emptyList()

            serviceWith(clock = kstSaturday).execute("머드", "ko", 8)

            range.captured shouldBe EventDateRange(startGte = null, startLte = null, endGte = LocalDate.of(2026, 10, 3))
        }
        then("결과에 행사 유효 기간과 코스 구성이 실린다") {
            every { searchPort.search(any(), any()) } returns found(
                listOf(
                    AttractionSearchPort.AttractionHit(
                        document().copy(
                            contentTypeId = "15",
                            eventPeriod = EventPeriod(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 12)),
                        ),
                        score = 1.0,
                    ),
                    AttractionSearchPort.AttractionHit(
                        document(id = "2").copy(
                            contentTypeId = "25",
                            courseStops = listOf(CourseStop(0, "126508", "경복궁", 1L), CourseStop(1, null, "광화문", null)),
                        ),
                        score = 1.0,
                    ),
                ),
            )

            val result = serviceWith(clock = kstSaturday).execute(SearchAttractionUseCase.Query(eventStatus = "NOT_ENDED"))

            with(result.attractions[0]) {
                eventStart shouldBe LocalDate.of(2026, 10, 1)
                eventEnd shouldBe LocalDate.of(2026, 10, 12)
                courseStops shouldBe null
            }
            with(result.attractions[1]) {
                eventStart shouldBe null
                courseStops shouldBe listOf(
                    SearchAttractionUseCase.CourseStop(0, "126508", "경복궁", 1L),
                    SearchAttractionUseCase.CourseStop(1, null, "광화문", null),
                )
            }
        }
    }
})

private const val MODEL_REF = "microsoft/harrier-oss-v1-270m@abc1234#d640"
