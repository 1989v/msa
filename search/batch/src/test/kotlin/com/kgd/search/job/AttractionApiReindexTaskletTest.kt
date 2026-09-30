package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.indexing.AttractionIndexDocument
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.mockk.Runs
import io.mockk.clearMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.test.util.ReflectionTestUtils
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import tools.jackson.module.kotlin.readValue
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicLong

class AttractionApiReindexTaskletTest : BehaviorSpec({
    val placeApiClient = mockk<PlaceApiClient>()
    val bulkProcessor = mockk<OsBulkDocumentProcessor>(relaxed = true)
    val aliasManager = mockk<IndexAliasManager>()
    val tasklet = AttractionApiReindexTasklet(placeApiClient, bulkProcessor, aliasManager).also {
        ReflectionTestUtils.setField(it, "indexAlias", "attractions")
        ReflectionTestUtils.setField(it, "pageSize", 100)
        // 기본은 빈 값 = 벡터 없이 색인. 첫 채움 전 운영이 실제로 이 상태다.
        ReflectionTestUtils.setField(it, "embeddingModelRef", "")
    }

    fun useModelRef(ref: String) = ReflectionTestUtils.setField(tasklet, "embeddingModelRef", ref)

    fun dto(id: Long, lang: String, status: String = "ACTIVE") = PlaceApiClient.AttractionDto(
        id = id, contentId = "c$id", lang = lang, title = "관광지$id",
        latitude = 37.5, longitude = 127.0, category = "history", status = status,
    )

    // bulk 요청에 실리는 모양 그대로 본다 — 운영 OpenSearch 클라이언트와 같은 설정의 매퍼로 문서를 직렬화한다.
    val bulkJson = jacksonMapperBuilder().disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS).build()
    fun bulkSource(doc: AttractionIndexDocument): Map<String, Any?> =
        bulkJson.readValue(bulkJson.writeValueAsString(doc))

    fun onePage(vararg attractions: PlaceApiClient.AttractionDto) {
        coEvery { placeApiClient.fetchPageAfter(0L, 100) } returns PlaceApiClient.AttractionPageResponse(
            attractions = attractions.toList(), nextAfterId = null,
        )
    }

    fun captureDocuments(): MutableList<AttractionIndexDocument> {
        val documents = mutableListOf<AttractionIndexDocument>()
        every { bulkProcessor.processDocument("attractions_1", any<String>(), capture(documents)) } just Runs
        return documents
    }

    /** 같은 시군구(서울 종로구 11/110)·같은 유형(12)에 놓인 관광지. */
    fun jongno(id: Long, lcls3: String?, lat: Double, lang: String = "ko") = dto(id, lang).copy(
        title = "종로$id", ldongRegnCd = "11", ldongSignguCd = "110", contentTypeId = "12",
        lclsSystm3 = lcls3, latitude = lat, longitude = 127.0,
    )

    beforeContainer {
        every { aliasManager.createTimestampedIndexName("attractions") } returns "attractions_1"
        every { aliasManager.createIndex("attractions_1", IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION) } just Runs
        every { aliasManager.updateAliasAndCleanup("attractions", "attractions_1", maxRetention = 1) } just Runs
        every { bulkProcessor.errorCount } returns AtomicLong(0)
    }

    given("관광지 재색인 실행 시") {
        `when`("place API 가 ACTIVE 2건 + 비활성 1건을 반환하면") {
            then("새 인덱스 생성 → ACTIVE 만 색인 → flush → alias swap 순서로 수행해야 한다") {
                coEvery { placeApiClient.fetchPageAfter(0L, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(dto(1, "ko"), dto(2, "en"), dto(3, "ko", status = "INACTIVE")),
                    nextAfterId = null,
                )

                val result = tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                result shouldBe RepeatStatus.FINISHED
                verify(exactly = 2) { bulkProcessor.processDocument("attractions_1", any<String>(), any<AttractionIndexDocument>()) }
                verify { bulkProcessor.flush() }
                // 보존은 한 벌 — 옛 벌이 페이지 캐시를 나눠 먹지 않게
                verify { aliasManager.updateAliasAndCleanup("attractions", "attractions_1", maxRetention = 1) }
            }
        }

        `when`("place 가 파생 표기·완결성 필드를 주면") {
            then("문서 title 은 표시명, titleLocal·idSort·popularityScore 가 실려야 한다") {
                val documents = mutableListOf<AttractionIndexDocument>()
                every { bulkProcessor.processDocument("attractions_1", any<String>(), capture(documents)) } just Runs
                coEvery { placeApiClient.fetchPageAfter(0L, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(
                        dto(7, "en").copy(
                            title = "Dosan Park(도산공원)",
                            titleDisplay = "Dosan Park", titleLocal = "도산공원",
                            imageUrl = "http://img/7", overview = "가".repeat(200), tel = "02-1",
                            googlePlaceId = "ChIJod7tSseifDUR9hXHLFNGMIs",
                        ),
                        // 파생 컬럼이 아직 없는 place 응답 — 원문 title 로 폴백한다
                        dto(8, "ko"),
                    ),
                    nextAfterId = null,
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val enriched = documents.single { it.id == "7" }
                enriched.title shouldBe "Dosan Park"
                enriched.titleLocal shouldBe "도산공원"
                enriched.googlePlaceId shouldBe "ChIJod7tSseifDUR9hXHLFNGMIs"
                enriched.idSort shouldBe 7L
                // base 1.0 + 이미지 1.0 + 개요(200자) 1.0 + 전화 0.2 (AttractionPopularity)
                enriched.popularityScore shouldBe (3.2 plusOrMinus 1e-9)

                val bare = documents.single { it.id == "8" }
                bare.title shouldBe "관광지8"
                bare.titleLocal shouldBe null
                bare.googlePlaceId shouldBe null
                bare.popularityScore shouldBe (1.0 plusOrMinus 1e-9)
            }
        }

        `when`("스탬프 설정이 비어 있으면") {
            then("place 벡터를 조회하지 않고 세 필드가 빈 채로 색인해야 한다") {
                val documents = mutableListOf<AttractionIndexDocument>()
                every { bulkProcessor.processDocument("attractions_1", any<String>(), capture(documents)) } just Runs
                coEvery { placeApiClient.fetchPageAfter(0L, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(dto(1, "ko")), nextAfterId = null,
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                coVerify(exactly = 0) { placeApiClient.lookupEmbeddings(any(), any()) }
                documents.single().embedding shouldBe null
                documents.single().embeddingModel shouldBe null
                documents.single().embeddingHash shouldBe null
            }
        }

        `when`("스탬프가 설정됐고 일부 문서만 벡터가 있으면") {
            then("있는 문서만 세 필드가 채워지고, 없는 문서는 벡터 없이 색인돼야 한다") {
                useModelRef(MODEL_REF)
                val documents = mutableListOf<AttractionIndexDocument>()
                every { bulkProcessor.processDocument("attractions_1", any<String>(), capture(documents)) } just Runs
                coEvery { placeApiClient.fetchPageAfter(0L, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(dto(1, "ko"), dto(2, "ko")), nextAfterId = null,
                )
                coEvery { placeApiClient.lookupEmbeddings(MODEL_REF, listOf(1L, 2L)) } returns mapOf(
                    1L to PlaceApiClient.EmbeddingDto(1L, "hash-1", listOf(0.6f, 0.8f)),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val withVector = documents.single { it.id == "1" }
                withVector.embedding shouldBe listOf(0.6f, 0.8f)
                withVector.embeddingModel shouldBe MODEL_REF
                withVector.embeddingHash shouldBe "hash-1"

                // 벡터가 없는 문서는 색인에서 빠지지 않는다 — BM25 로는 여전히 찾혀야 한다
                val without = documents.single { it.id == "2" }
                without.embedding shouldBe null
                without.embeddingModel shouldBe null
                without.embeddingHash shouldBe null

                useModelRef("")
            }
        }
    }

    given("재색인이 비슷한 곳을 붙일 때") {
        /** 서울(11) 관광지 하나와 다른 시도 관광지들. */
        fun seoul(id: Long) = jongno(id, "VE030100", 37.5)
        fun elsewhere(id: Long, sido: String, status: String = "ACTIVE") =
            jongno(id, "VE030100", 35.1).copy(ldongRegnCd = sido, title = "먼곳$id", status = status)

        `when`("place 가 준 목록에 비활성 문서가 섞여 있으면") {
            then("활성 문서만 순위 순서대로 제목·시도 이름과 함께 실려야 한다") {
                useModelRef(MODEL_REF)
                val documents = captureDocuments()
                onePage(seoul(1), elsewhere(21, "26"), elsewhere(22, "26", status = "INACTIVE"), elsewhere(23, "41"))
                coEvery { placeApiClient.fetchSidoNames("ko") } returns mapOf("26" to "부산광역시", "41" to "경기도")
                coEvery { placeApiClient.lookupEmbeddings(any(), any()) } returns emptyMap()
                coEvery { placeApiClient.lookupSimilar(MODEL_REF, listOf(1L, 21L, 23L)) } returns mapOf(
                    1L to PlaceApiClient.SimilarDto(MODEL_REF, listOf(23L, 22L, 21L, 999L)),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                @Suppress("UNCHECKED_CAST")
                val similar = bulkSource(documents.single { it.id == "1" })["similarElsewhere"] as List<Map<String, Any?>>
                // 22 는 비활성, 999 는 이번 회차에 없는 문서 — 둘 다 상세에서 깨진 링크가 된다
                similar.map { it["id"] } shouldContainExactly listOf("23", "21")
                similar.first()["title"] shouldBe "먼곳23"
                similar.first()["sidoName"] shouldBe "경기도"
                bulkSource(documents.single { it.id == "21" }).keys shouldNotContain "similarElsewhere"

                useModelRef("")
            }
        }

        `when`("목록의 스탬프가 설정과 다르면") {
            then("그 목록은 싣지 않아야 한다 — 다른 벡터 공간에서 계산한 순위다") {
                useModelRef(MODEL_REF)
                val documents = captureDocuments()
                onePage(seoul(1), elsewhere(21, "26"))
                coEvery { placeApiClient.lookupEmbeddings(any(), any()) } returns emptyMap()
                coEvery { placeApiClient.lookupSimilar(MODEL_REF, any()) } returns mapOf(
                    1L to PlaceApiClient.SimilarDto("microsoft/harrier-oss-v1-270m@0000000#d640", listOf(21L)),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                bulkSource(documents.single { it.id == "1" }).keys shouldNotContain "similarElsewhere"
                useModelRef("")
            }
        }

        `when`("비슷한 곳 조회가 실패하면") {
            then("필드만 비고 색인과 별칭 교체는 끝까지 가야 한다") {
                useModelRef(MODEL_REF)
                clearMocks(aliasManager, answers = false)
                val documents = captureDocuments()
                onePage(seoul(1), elsewhere(21, "26"))
                coEvery { placeApiClient.lookupEmbeddings(any(), any()) } returns emptyMap()
                coEvery { placeApiClient.lookupSimilar(any(), any()) } throws IllegalStateException("place down")

                val result = tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                result shouldBe RepeatStatus.FINISHED
                documents.map { it.id } shouldContainExactly listOf("1", "21")
                documents.forEach { bulkSource(it).keys shouldNotContain "similarElsewhere" }
                verify { aliasManager.updateAliasAndCleanup("attractions", "attractions_1", maxRetention = 1) }
                useModelRef("")
            }
        }

        `when`("스탬프 설정이 비어 있으면") {
            then("비슷한 곳을 조회하지 않아야 한다 — 목록은 스탬프에 묶여 있다") {
                clearMocks(placeApiClient, answers = false)
                captureDocuments()
                onePage(seoul(1))

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                coVerify(exactly = 0) { placeApiClient.lookupSimilar(any(), any()) }
            }
        }
    }

    given("재색인이 속성과 지역 안 위치를 붙일 때") {
        `when`("원천 문구가 해석되는 관광지면") {
            then("bulk 문서에 정규화한 속성과 파서 판이 실려야 한다") {
                val documents = captureDocuments()
                onePage(
                    dto(1, "ko").copy(
                        restDate = "매주 월요일 / 1월 1일 / 설·추석 당일",
                        parking = "가능",
                        useFee = "무료",
                        petAcmpyType = "전구역 동반가능",
                        introRaw = """{"contentid":"126508","chkcreditcard":"가능","chkbabycarriage":"없음","infocenter":"02-1"}""",
                    ),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val source = bulkSource(documents.single())
                source["closureState"] shouldBe "WEEKLY"
                source["closedWeekdays"] shouldBe listOf("MON")
                source["attrParking"] shouldBe "YES"
                source["petPolicy"] shouldBe "ALLOWED"
                source["attrCreditCard"] shouldBe "YES"
                source["attrStrollerRental"] shouldBe "NO"
                source["attrAdmission"] shouldBe "FREE"
                source["attributeParserVersion"] shouldBe 1
                // 원문은 그대로 남는다 — 파생이 원천을 덮지 않는다
                source["restDate"] shouldBe "매주 월요일 / 1월 1일 / 설·추석 당일"
                source["petAcmpyType"] shouldBe "전구역 동반가능"
            }
        }

        `when`("원천 문구가 없거나 해석되지 않으면") {
            then("UNKNOWN 을 빼지 않고 명시값으로 싣고, 요일 목록은 싣지 않아야 한다") {
                val documents = captureDocuments()
                onePage(
                    dto(1, "en").copy(restDate = "Closed on the 1st Monday of every month", introRaw = "{not json"),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val source = bulkSource(documents.single())
                source["closureState"] shouldBe "UNKNOWN"
                source.keys shouldNotContain "closedWeekdays"
                source["attrParking"] shouldBe "UNKNOWN"
                source["petPolicy"] shouldBe "UNKNOWN"
                source["attrCreditCard"] shouldBe "UNKNOWN"
                source["attrStrollerRental"] shouldBe "UNKNOWN"
                source["attrAdmission"] shouldBe "UNKNOWN"
                source["attributeParserVersion"] shouldBe 1
            }
        }

        `when`("연중무휴와 공휴일만 쉬는 곳이면") {
            then("ALWAYS_OPEN 과 NO_WEEKLY 로 갈라 실어야 한다") {
                val documents = captureDocuments()
                onePage(dto(1, "ko").copy(restDate = "연중무휴"), dto(2, "ko").copy(restDate = "1월 1일, 설·추석 당일"))

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                bulkSource(documents.single { it.id == "1" })["closureState"] shouldBe "ALWAYS_OPEN"
                val holidayOnly = bulkSource(documents.single { it.id == "2" })
                holidayOnly["closureState"] shouldBe "NO_WEEKLY"
                holidayOnly.keys shouldNotContain "closedWeekdays"
            }
        }

        `when`("같은 시군구·유형 문서가 두 페이지에 흩어져 있으면") {
            then("1차 훑기가 모은 수·가까운 곳·이름이 bulk 문서에 실려야 한다") {
                // 호출 횟수를 세므로 앞선 실행의 기록만 지운다 (스텁은 남긴다)
                clearMocks(placeApiClient, answers = false)
                val documents = captureDocuments()
                coEvery { placeApiClient.fetchPageAfter(0L, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(
                        jongno(1, "VE030100", 37.500),
                        jongno(2, "VE030100", 37.501),
                        // 비활성은 색인하지 않으므로 수에도 들지 않는다
                        jongno(9, "VE030100", 37.5005).copy(status = "INACTIVE"),
                    ),
                    // 이 쪽의 마지막 id 가 다음 요청의 afterId 다
                    nextAfterId = 9L,
                )
                coEvery { placeApiClient.fetchPageAfter(9L, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(
                        jongno(3, "VE030100", 37.510),
                        jongno(4, "VE070100", 37.502),
                        // 다른 시도(부산 26)의 같은 3자리 시군구 코드 — 종로와 섞이면 안 된다
                        jongno(5, "VE030100", 37.5001).copy(ldongRegnCd = "26"),
                    ),
                    nextAfterId = null,
                )
                coEvery { placeApiClient.fetchSigunguNames() } returns mapOf(
                    "ko" to mapOf("11110" to "종로구", "26110" to "중구"),
                    "en" to mapOf("11110" to "Jongno-gu", "26110" to "Jung-gu"),
                )
                coEvery { placeApiClient.fetchCategoryNames("ko") } returns mapOf("VE030100" to "고궁")
                coEvery { placeApiClient.fetchCategoryNames("en") } returns emptyMap()

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val first = bulkSource(documents.single { it.id == "1" })
                first["sigunguName"] shouldBe "종로구"
                // 유형 수 N 은 분류가 다른 4 까지, 분류 수 M 은 같은 분류만 — M ≤ N
                first["regionTypeCount"] shouldBe 4
                first["regionCategoryCount"] shouldBe 3
                first["lclsSystm3Name"] shouldBe "고궁"
                @Suppress("UNCHECKED_CAST")
                val nearby = first["sameCategoryNearby"] as List<Map<String, Any?>>
                nearby.map { it["id"] } shouldContainExactly listOf("2", "3")
                nearby.first()["title"] shouldBe "종로2"
                // 위도 0.001도 ≈ 111m
                (nearby.first()["distanceMeters"] as Int) shouldBe 111

                val busan = bulkSource(documents.single { it.id == "5" })
                busan["sigunguName"] shouldBe "중구"
                busan["regionTypeCount"] shouldBe 1
                busan["sameCategoryNearby"] shouldBe emptyList<Any>()

                // 두 번 훑는다 — 1차·2차 모두 키셋으로, 앞 쪽이 준 커서를 다음 요청에 넘긴다
                coVerifyOrder {
                    placeApiClient.fetchPageAfter(0L, 100)
                    placeApiClient.fetchPageAfter(9L, 100)
                    placeApiClient.fetchPageAfter(0L, 100)
                    placeApiClient.fetchPageAfter(9L, 100)
                }
                coVerify(exactly = 4) { placeApiClient.fetchPageAfter(any(), any()) }
            }
        }

        `when`("시군구 코드나 유형이 빠진 문서면") {
            then("지역 필드 없이 색인되고 속성은 그대로 실려야 한다") {
                val documents = captureDocuments()
                onePage(
                    jongno(1, "VE030100", 37.5),
                    jongno(2, "VE030100", 37.5).copy(ldongSignguCd = null),
                    jongno(3, "VE030100", 37.5).copy(contentTypeId = null),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                documents.map { it.id } shouldContainExactly listOf("1", "2", "3")
                listOf("2", "3").forEach { id ->
                    val source = bulkSource(documents.single { it.id == id })
                    listOf("sigunguName", "regionTypeCount", "regionCategoryCount", "lclsSystm3Name", "sameCategoryNearby")
                        .forEach { source.keys shouldNotContain it }
                    source.keys shouldContain "closureState"
                }
                // 빠진 문서는 남의 수에도 들지 않는다
                bulkSource(documents.single { it.id == "1" })["regionTypeCount"] shouldBe 1
            }
        }

        `when`("place 페이지 호출이 제한 시간을 넘기면") {
            then("잡이 실패하고 별칭은 넘기지 않아야 한다") {
                clearMocks(aliasManager, answers = false)
                coEvery { placeApiClient.fetchPageAfter(0L, 100) } throws TimeoutException("place 응답 없음")

                shouldThrow<TimeoutException> { tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>()) }

                verify(exactly = 0) { aliasManager.updateAliasAndCleanup(any(), any(), any()) }
            }
        }

        `when`("영문 문서이고 이름표 조회가 실패하면") {
            then("수와 가까운 곳은 싣고 이름만 비운 채 재색인이 끝나야 한다") {
                val documents = captureDocuments()
                onePage(jongno(1, "VE030100", 37.5, lang = "en"), jongno(2, "VE030100", 37.6, lang = "en"))
                coEvery { placeApiClient.fetchSigunguNames() } throws IllegalStateException("place down")
                coEvery { placeApiClient.fetchCategoryNames(any()) } throws IllegalStateException("place down")

                val result = tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                result shouldBe RepeatStatus.FINISHED
                val source = bulkSource(documents.single { it.id == "1" })
                source["regionTypeCount"] shouldBe 2
                source["regionCategoryCount"] shouldBe 2
                source.keys shouldNotContain "sigunguName"
                source.keys shouldNotContain "lclsSystm3Name"
            }
        }
    }
})

private const val MODEL_REF = "microsoft/harrier-oss-v1-270m@abc1234#d640"
