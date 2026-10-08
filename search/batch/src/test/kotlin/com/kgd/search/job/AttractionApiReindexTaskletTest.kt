package com.kgd.search.infrastructure.job

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.kgd.search.domain.attraction.model.AttractionAttributeParser
import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.clicksignal.ClickHouseClickSignalReader
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
import io.kotest.matchers.string.shouldContain
import org.slf4j.LoggerFactory
import io.mockk.Runs
import io.mockk.clearMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.test.util.ReflectionTestUtils
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import tools.jackson.module.kotlin.readValue
import java.sql.SQLException
import java.io.File
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicLong

/** 고캠핑 운영 응답(2026-10-07, contentId 8031)에서 place 가 고른 화면용 키 */
private const val CAMPING = """{"induty":"일반야영장","gnrlSiteCo":"25","sbrsCl":"전기,무선인터넷,장작판매","animalCmgCl":"가능","operPdCl":"봄,여름,가을,겨울"}"""

class AttractionApiReindexTaskletTest : BehaviorSpec({
    val placeApiClient = mockk<PlaceApiClient>()
    val bulkProcessor = mockk<OsBulkDocumentProcessor>(relaxed = true)
    val aliasManager = mockk<IndexAliasManager>()
    val clickReader = mockk<ClickHouseClickSignalReader>()
    val tasklet = AttractionApiReindexTasklet(placeApiClient, bulkProcessor, aliasManager, clickReader).also {
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
        every { clickReader.loadUniqueClickers(any()) } returns emptyMap()
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
                source["attributeParserVersion"] shouldBe AttractionAttributeParser.VERSION
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
                source["attributeParserVersion"] shouldBe AttractionAttributeParser.VERSION
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

    given("재색인이 행사 유효 기간·코스 구성을 싣고 끝난 행사를 후보에서 뺄 때") {
        // 재색인일은 KST 2026-10-02 00:30 — UTC 날짜(10-01)로 판정하면 어제 끝난 행사가 진행 중으로 남는다
        val clock = Clock.fixed(Instant.parse("2026-10-01T15:30:00Z"), ZoneOffset.UTC)
        val timedTasklet = AttractionApiReindexTasklet(placeApiClient, bulkProcessor, aliasManager, clickReader, clock).also {
            ReflectionTestUtils.setField(it, "indexAlias", "attractions")
            ReflectionTestUtils.setField(it, "pageSize", 100)
            ReflectionTestUtils.setField(it, "embeddingModelRef", MODEL_REF)
            // 캡처에 언어 대체 짝이 실려야 읽기 쪽 왕복이 무언가를 잰다
            ReflectionTestUtils.setField(it, "alternatePairsEnabled", true)
        }
        fun date(value: String) = LocalDate.parse(value)
        fun event(id: Long, start: String?, end: String?, lat: Double) = jongno(id, "EV010100", lat).copy(
            title = "행사$id", contentTypeId = "15", eventStartDate = start?.let(::date), eventEndDate = end?.let(::date),
        )
        val courseRaw = repoRoot().resolve("search/domain/src/test/resources/course/info-raw-1965837-ko.json").readText()
        val inputs = listOf(
            event(101, "2026-09-25", "2026-10-05", 37.5001), // 진행 중
            event(102, "2026-10-10", null, 37.5002), // 시작일만 — 하루짜리 예정 행사
            event(103, "2026-09-01", "2026-10-01", 37.50005), // 어제(KST) 끝남 — 가장 가깝지만 후보가 아니다
            event(104, "2026-10-20", "2026-10-03", 37.50003), // S>E — 날짜 없음
            event(105, null, null, 37.50004), // 날짜 없음
            // 출처·공공누리 유형·요금은 읽기 쪽 왕복용 — 201 은 use_fee, 202 는 반복정보 요금 행에서 요금 텍스트가 나온다
            jongno(201, "VE030100", 37.5).copy(source = "TOURAPI", copyrightDivCd = "Type1", useFee = "무료"), // 행사가 아닌 대조군 — 끝난 행사 규칙의 영향을 받지 않는다
            jongno(202, "VE030100", 37.501).copy(
                source = "GOCAMPING", copyrightDivCd = "Type3",
                infoRaw = """[{"fldgubun":"1","infoname":"입 장 료","infotext":"&lt;어린이&gt; 무료<br>어른 2,000원","serialnum":"0"}]""",
            ),
            // 같은 시군구·유형에 날짜가 실려 와도 행사가 아니면 행사 규칙을 적용하지 않는다
            jongno(203, "VE030100", 37.502).copy(eventStartDate = date("2026-01-01"), eventEndDate = date("2026-01-02")),
            dto(301, "ko").copy(contentId = "1965837", contentTypeId = "25", title = "코스301", infoRaw = courseRaw),
            dto(302, "ko").copy(contentId = "2000001", contentTypeId = "25", title = "코스302", infoRaw = "{not json"),
            // 코스 지점의 같은 언어 관광지 — 128138 · 128168 은 국문, 1870538 은 영문뿐이라 잇지 않는다
            dto(401, "ko").copy(contentId = "128138"),
            dto(402, "ko").copy(contentId = "128168"),
            dto(403, "en").copy(contentId = "1870538"),
            // 같은 장소의 두 등록 — 부산타워 운영 행처럼 관광지(12)·쇼핑(38)이 같은 자리에. 종로 집계에 섞이지 않게 부산 중구에 둔다
            jongno(501, "HS020100", 35.10120).copy(ldongRegnCd = "26", ldongSignguCd = "110", title = "부산타워"),
            jongno(502, "SH040300", 35.10121).copy(ldongRegnCd = "26", ldongSignguCd = "110", title = "부산타워", contentTypeId = "38"),
            // 언어 대체 짝 — 국문 601 ↔ 영문 602. 다른 시군구(부산 영도구)에 둬 위 집계에 섞이지 않게 한다. 601 만 본문 변경 시각이 있다
            jongno(601, "HS020100", 35.07870).copy(
                ldongRegnCd = "26", ldongSignguCd = "200", title = "태종대", googlePlaceId = "ChIJ-tjd", overview = "해안 절벽",
                contentUpdatedAt = LocalDateTime.of(2026, 10, 1, 8, 0, 0),
            ),
            jongno(602, "HS020100", 35.07871, lang = "en").copy(
                ldongRegnCd = "26", ldongSignguCd = "200", contentTypeId = "76", title = "Taejongdae (태종대)",
                titleDisplay = "Taejongdae", titleLocal = "태종대", googlePlaceId = "ChIJ-tjd", overview = "Coastal cliffs",
            ),
        )

        // place 링크 벌크 조회가 준 원문 — 상세 화면은 색인에 실린 이 원문을 그대로 푼다
        val sourceLinks = mapOf(
            201L to """{"collected":[{"source":"YOUTUBE","externalId":"v1","title":"경복궁 야경","url":"https://youtu.be/v1",""" +
                """"thumbnailUrl":"https://i.ytimg.com/v1.jpg","author":"서울여행","publishedAt":"2026-09-01T12:30:00","viewCount":123456}],""" +
                """"deepLinks":[{"provider":"INSTAGRAM","kind":"SOCIAL","url":"https://www.instagram.com/explore/tags/a","revenueType":"PLAIN"}]}""",
            301L to """{"collected":[],"deepLinks":[{"provider":"MYREALTRIP","kind":"TOUR_PRODUCT","url":"https://example.com/t","revenueType":"AFFILIATE"}]}""",
        )

        // place 부가 정보 묶음 조회가 준 값 — 상세 원문은 경복궁(126508) 운영 응답, 코드는 수집기가 같은 원문에서 낸 값
        val gyeongbokgungDetail = tools.jackson.databind.ObjectMapper().let { json ->
            json.writeValueAsString(
                json.readTree(repoRoot().resolve(PHASE2_SAMPLE_PATH).readText()).path("1 무장애 상세").path("sample").path(0),
            )
        }
        val sourceExtras = mapOf(
            201L to PlaceApiClient.ExtrasDto(
                listOf("PARKING", "WHEELCHAIR", "EXIT", "RESTROOM", "AUDIO_GUIDE", "STROLLER", "LACTATION_ROOM", "INFANT_ETC"),
                gyeongbokgungDetail,
                null,
            ),
            // 웰니스 국문 표본의 테마 코드 — 이름은 운영 분류 코드표 값
            202L to PlaceApiClient.ExtrasDto(null, null, "EX050100", camping = CAMPING),
            // 상세 원문을 못 읽으면 코드만 싣는다. 연관 관광지 — place 가 고른 순위 순 그대로 온다. 자기 자신(401) · 끝난 행사(103) ·
            // 영문 문서(403) · 겹친 id(202) 는 빠지고, 남는 앞의 6곳만 실린다(302 · 402 는 잘린다)
            401L to PlaceApiClient.ExtrasDto(
                listOf("WHEELCHAIR"), "{not json", null,
                relatedPlaces = listOf(1 to 401L, 2 to 103L, 3 to 202L, 4 to 403L, 5 to 201L, 6 to 202L, 7 to 101L, 8 to 102L, 9 to 203L, 10 to 301L, 11 to 302L, 12 to 402L)
                    .map { (rank, id) -> PlaceApiClient.RelatedPlaceDto(rank, id, if (rank == 3) "자연경관(하천/해양)" else null) },
            ),
            // 집중률 — 해운대해수욕장 운영 응답(2026-10-02) 앞 사흘을 순서를 섞어서, 날짜를 못 읽는 날 하나를 끼워서
            402L to PlaceApiClient.ExtrasDto(
                null, null, null,
                listOf(
                    PlaceApiClient.CongestionDayDto("2026-10-03", 98.14),
                    PlaceApiClient.CongestionDayDto("2026-10-02", 84.23),
                    PlaceApiClient.CongestionDayDto("20261004", 93.41),
                ),
            ),
        )

        `when`("재색인하면") {
            clearMocks(placeApiClient, answers = false)
            val documents = captureDocuments()
            onePage(*inputs.toTypedArray())
            coEvery { placeApiClient.lookupEmbeddings(any(), any()) } returns emptyMap()
            coEvery { placeApiClient.lookupLinks(any()) } answers { sourceLinks.filterKeys { it in firstArg<List<Long>>() } }
            coEvery { placeApiClient.lookupExtras(any()) } answers { sourceExtras.filterKeys { it in firstArg<List<Long>>() } }
            coEvery { placeApiClient.fetchCategoryNames("ko") } returns mapOf("EX050100" to "온천 / 사우나 / 스파")
            coEvery { placeApiClient.lookupSimilar(MODEL_REF, any()) } returns mapOf(
                // 103 은 끝난 행사, 105 는 날짜 없는 행사 — 둘 다 빠지고 순위 순서는 남는다
                201L to PlaceApiClient.SimilarDto(MODEL_REF, listOf(103L, 101L, 105L, 202L)),
            )
            val logs = ListAppender<ILoggingEvent>().also { appender ->
                appender.start()
                (LoggerFactory.getLogger(AttractionApiReindexTasklet::class.java) as Logger).addAppender(appender)
            }

            timedTasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())
            val sources = documents.associate { it.id to bulkSource(it) }
            writeReindexCapture(documents, inputs, sourceLinks, sourceExtras)

            then("무장애는 코드와 값 있는 원천 문장(원천 키 순서)을, 웰니스는 코드와 분류 이름을 싣는다") {
                sources.getValue("201")["barrierFree"] shouldBe sourceExtras.getValue(201L).barrierFreeFlags
                @Suppress("UNCHECKED_CAST")
                val detail = sources.getValue("201")["barrierFreeDetail"] as Map<String, String>
                detail.keys.toList() shouldContainExactly listOf(
                    "parking", "wheelchair", "exit", "restroom", "audioguide", "stroller", "lactationroom", "infantsfamilyetc",
                )
                detail["wheelchair"] shouldBe "대여가능"
                sources.getValue("201").keys shouldNotContain "wellnessTheme"
                sources.getValue("202")["wellnessTheme"] shouldBe "EX050100"
                sources.getValue("202")["wellnessThemeName"] shouldBe "온천 / 사우나 / 스파"
                sources.getValue("202").keys shouldNotContain "barrierFree"
                // 상세 원문을 못 읽은 곳은 코드만 남는다
                sources.getValue("401")["barrierFree"] shouldBe listOf("WHEELCHAIR")
                sources.getValue("401").keys shouldNotContain "barrierFreeDetail"
                listOf("101", "301", "402").forEach { id ->
                    sources.getValue(id).keys shouldNotContain "barrierFree"
                    sources.getValue(id).keys shouldNotContain "wellnessTheme"
                }
            }

            then("캠핑장 정보는 place 가 고른 JSON 문자열을 그대로 싣고, 캠핑장이 아니면 필드가 없다") {
                sources.getValue("202")["camping"] shouldBe CAMPING
                listOf("101", "201", "401").forEach { id -> sources.getValue(id).keys shouldNotContain "camping" }
            }

            then("집중률은 읽을 수 있는 날만 예측일 순으로 yyyy-MM-dd · 원천 값 그대로 싣고, 없는 문서는 필드가 없다") {
                sources.getValue("402")["congestion"] shouldBe listOf(
                    mapOf("date" to "2026-10-02", "rate" to 84.23),
                    mapOf("date" to "2026-10-03", "rate" to 98.14),
                )
                listOf("101", "201", "202", "401").forEach { id -> sources.getValue(id).keys shouldNotContain "congestion" }
            }

            then("연관 관광지는 같은 언어 활성 문서만 place 순서(원천 순위)대로 최대 6곳, 지금 제목·시도·원천 소분류를 싣고, 없는 문서는 필드가 없다") {
                @Suppress("UNCHECKED_CAST")
                val related = sources.getValue("401")["relatedPlaces"] as List<Map<String, Any?>>
                related.map { it["rank"] to it["id"] } shouldContainExactly
                    listOf(3 to "202", 5 to "201", 7 to "101", 8 to "102", 9 to "203", 10 to "301")
                related.map { it["title"] } shouldContainExactly listOf("종로202", "종로201", "행사101", "행사102", "종로203", "코스301")
                related.first()["category"] shouldBe "자연경관(하천/해양)"
                listOf("101", "201", "202", "402").forEach { id -> sources.getValue(id).keys shouldNotContain "relatedPlaces" }
            }

            then("같은 시군구·제목·1km 안의 다른 등록을 서로 싣고(제목 없이 id·유형만), 없는 문서는 필드가 없다") {
                sources.getValue("501")["samePlace"] shouldBe listOf(mapOf("id" to "502", "contentTypeId" to "38"))
                sources.getValue("502")["samePlace"] shouldBe listOf(mapOf("id" to "501", "contentTypeId" to "12"))
                listOf("101", "201", "202", "401").forEach { id -> sources.getValue(id).keys shouldNotContain "samePlace" }
            }

            then("행사는 정규화한 유효 기간을 yyyy-MM-dd 로 싣고, 날짜 없는 행사와 행사 아닌 문서는 필드가 없다") {
                sources.getValue("101")["eventStartEffective"] shouldBe "2026-09-25"
                sources.getValue("101")["eventEndEffective"] shouldBe "2026-10-05"
                sources.getValue("102")["eventStartEffective"] shouldBe "2026-10-10"
                sources.getValue("102")["eventEndEffective"] shouldBe "2026-10-10"
                // 끝난 행사도 문서는 색인된다 — 상세는 「종료된 행사」로 그린다
                sources.getValue("103")["eventEndEffective"] shouldBe "2026-10-01"
                listOf("104", "105", "201", "203").forEach { id ->
                    sources.getValue(id).keys shouldNotContain "eventStartEffective"
                    sources.getValue(id).keys shouldNotContain "eventEndEffective"
                }
            }

            then("끝난 행사·날짜 없는 행사는 가까운 곳 후보와 지역 건수에서 빠지고, 항목에 유효 종료일이 실린다") {
                val ongoing = sources.getValue("101")
                ongoing["regionTypeCount"] shouldBe 2
                @Suppress("UNCHECKED_CAST")
                val nearby = ongoing["sameCategoryNearby"] as List<Map<String, Any?>>
                nearby.map { it["id"] } shouldContainExactly listOf("102")
                nearby.single()["eventEndEffective"] shouldBe "2026-10-10"
                // 끝난·날짜 없는 행사 자신도 지역 안 위치를 갖는다 — 수와 가까운 곳은 진행 중·예정 후보로만 센다
                listOf("103", "104", "105").forEach { id ->
                    val excluded = sources.getValue(id)
                    (id to excluded["regionTypeCount"]) shouldBe (id to 2)
                    (id to excluded["regionCategoryCount"]) shouldBe (id to 2)
                    @Suppress("UNCHECKED_CAST")
                    (id to (excluded["sameCategoryNearby"] as List<Map<String, Any?>>).map { it["id"] }.toSet()) shouldBe
                        (id to setOf("101", "102"))
                }
                // 그러나 어느 문서의 후보에도 들지 않는다 (103 은 101 바로 옆이라 섞이면 첫 자리에 온다)
                sources.values.forEach { source ->
                    @Suppress("UNCHECKED_CAST")
                    val ids = (source["sameCategoryNearby"] as List<Map<String, Any?>>?).orEmpty().map { it["id"] }
                    listOf("103", "104", "105").forEach { ids shouldNotContain it }
                }
                // 대조군: 행사가 아닌 문서는 날짜가 실려 와도 그대로 센다
                sources.getValue("201")["regionTypeCount"] shouldBe 3
                @Suppress("UNCHECKED_CAST")
                (sources.getValue("201")["sameCategoryNearby"] as List<Map<String, Any?>>)
                    .forEach { it["eventEndEffective"] shouldBe null }
            }

            then("비슷한 곳에서도 끝난 행사·날짜 없는 행사가 빠지고, 남은 행사 항목에 유효 종료일이 실린다") {
                @Suppress("UNCHECKED_CAST")
                val similar = sources.getValue("201")["similarElsewhere"] as List<Map<String, Any?>>
                similar.map { it["id"] } shouldContainExactly listOf("101", "202")
                similar[0]["eventEndEffective"] shouldBe "2026-10-05"
                similar[1]["eventEndEffective"] shouldBe null
            }

            then("place 가 준 링크 원문이 그 문서에 그대로 실리고, 링크 없는 문서는 필드가 없다") {
                sources.getValue("201")["links"] shouldBe sourceLinks.getValue(201L)
                sources.getValue("301")["links"] shouldBe sourceLinks.getValue(301L)
                sources.getValue("202").keys shouldNotContain "links"
            }

            then("코스 구성은 subnum 순서로 실리고, 같은 언어 관광지가 있는 지점만 id 가 붙는다") {
                @Suppress("UNCHECKED_CAST")
                val stops = sources.getValue("301")["courseStops"] as List<Map<String, Any?>>
                stops.map { it["order"] } shouldContainExactly listOf(0, 1, 2, 3, 3, 4, 4, 5)
                stops.map { it["contentId"] } shouldContainExactly
                    listOf("128138", "125551", "129195", "128168", "1870538", "128168", "129196", "129196")
                stops.map { (it["attractionId"] as Number?)?.toLong() } shouldContainExactly
                    listOf(401L, null, null, 402L, null, 402L, null, null)
                // 원문을 못 읽은 코스와 코스가 아닌 문서는 필드가 없다
                sources.getValue("302").keys shouldNotContain "courseStops"
                sources.getValue("401").keys shouldNotContain "courseStops"
            }

            then("완료 로그에 유효 기간 적재 · S>E · 날짜 없음 · 코스 적재 · 해석 실패 · 링크 못 단 지점 수가 남는다") {
                val complete = logs.list.map { it.formattedMessage }.single { it.startsWith("Attraction reindex complete") }
                complete shouldContain "events (today 2026-10-02) period 3, S>E 1, no date 1"
                complete shouldContain "courses stops 1, unreadable infoRaw 1, unmatched stops 5"
                complete shouldContain "barrier-free 2 (unreadable 1), wellness 1, congestion 1 (unreadable days 1), " +
                    "related 1 (not active 2), extras lookup failures 0"
                logs.list.map { it.formattedMessage }.single { it.startsWith("Region pass") } shouldContain
                    "3 ended/undated events left out as of 2026-10-02"
            }
        }
    }

    given("재색인이 요금 텍스트와 원천 출처를 실을 때") {
        // 운영 반복정보 행 모양(detailInfo2) — 요금이 접힌 컬럼(use_fee)이 아니라 여기에만 있는 관광지가 많다
        fun infoRaw(vararg rows: Pair<String, String>) = tools.jackson.databind.ObjectMapper().writeValueAsString(
            rows.mapIndexed { i, (name, text) ->
                mapOf("fldgubun" to "1", "infoname" to name, "infotext" to text, "serialnum" to "$i", "contenttypeid" to "12")
            },
        )

        `when`("use_fee 가 비고 반복정보 요금 행이 「무료」면") {
            then("요금 텍스트가 그 행에서 채워지고, 입장 판정도 같은 값으로 FREE 다 — 원천 두 필드는 그대로 남는다") {
                val documents = captureDocuments()
                val raw = infoRaw("화장실" to "있음", "입장료" to "무료")
                onePage(dto(1, "ko").copy(useFee = null, infoRaw = raw))

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val source = bulkSource(documents.single())
                source["feeText"] shouldBe "무료"
                source["attrAdmission"] shouldBe "FREE"
                source["attributeParserVersion"] shouldBe AttractionAttributeParser.VERSION
                source.keys shouldNotContain "useFee"
                source["infoRaw"] shouldBe raw
            }
        }

        `when`("반복정보 요금 행에 금액이 있으면") {
            then("요금 텍스트에 금액이 실리고 입장 판정은 PAID 다") {
                val documents = captureDocuments()
                onePage(dto(1, "ko").copy(infoRaw = infoRaw("관람료" to "어른 3,000원<br>어린이 1,000원")))

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val source = bulkSource(documents.single())
                source["feeText"] shouldBe "어른 3,000원\n어린이 1,000원"
                source["attrAdmission"] shouldBe "PAID"
            }
        }

        `when`("코스의 infoRaw 가 JSON 이 아니면") {
            then("요금 텍스트는 use_fee 로 채워지고, 코스 구성은 지금처럼 비고 경고가 남는다") {
                val documents = captureDocuments()
                onePage(
                    dto(1, "ko").copy(contentTypeId = "25", useFee = "성인 1,000원", infoRaw = "{not json"),
                    dto(2, "ko").copy(infoRaw = "{not json"),
                )
                val logs = ListAppender<ILoggingEvent>().also { appender ->
                    appender.start()
                    (LoggerFactory.getLogger(AttractionApiReindexTasklet::class.java) as Logger).addAppender(appender)
                }

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val course = bulkSource(documents.single { it.id == "1" })
                course["feeText"] shouldBe "성인 1,000원"
                course["attrAdmission"] shouldBe "PAID"
                course.keys shouldNotContain "courseStops"
                logs.list.map { it.formattedMessage }.single { it.startsWith("코스 구성 해석 실패 (id=1)") } shouldContain "JSON 이 아니다"
                // use_fee 도 읽히는 요금 행도 없으면 필드가 없다 — 빈 문자열로 싣지 않는다
                bulkSource(documents.single { it.id == "2" }).keys shouldNotContain "feeText"
                // 코스가 아닌 문서는 코스 경고를 남기지 않는다
                logs.list.none { it.formattedMessage.startsWith("코스 구성 해석 실패 (id=2)") } shouldBe true
            }
        }

        `when`("place 가 출처와 공공누리 유형을 주면") {
            then("bulk 문서에 같은 값이 실리고, 없는 문서는 필드가 없다") {
                val documents = captureDocuments()
                onePage(
                    dto(1, "ko").copy(source = "GOCAMPING", copyrightDivCd = "Type3"),
                    dto(2, "ko"),
                )

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val given = bulkSource(documents.single { it.id == "1" })
                given["source"] shouldBe "GOCAMPING"
                given["copyrightDivCd"] shouldBe "Type3"
                val missing = bulkSource(documents.single { it.id == "2" })
                missing.keys shouldNotContain "source"
                missing.keys shouldNotContain "copyrightDivCd"
            }
        }
    }

    given("재색인이 언어 대체 짝과 본문 변경 시각을 실을 때") {
        // 국문 11 ↔ 영문 12 는 짝(placeId·50m 안·같은 유형·로컬명 = 표시명·양쪽 개요). 13 은 placeId 가 같아도 제목이 다르다
        val changedAt = LocalDateTime.of(2026, 10, 8, 9, 10, 11)
        fun pairInputs() = arrayOf(
            dto(11, "ko").copy(
                title = "경복궁", contentTypeId = "12", googlePlaceId = "ChIJ-gbg", overview = "조선의 법궁",
                contentUpdatedAt = changedAt,
            ),
            dto(12, "en").copy(
                title = "Gyeongbokgung Palace (경복궁)", titleDisplay = "Gyeongbokgung Palace", titleLocal = "경복궁",
                contentTypeId = "76", googlePlaceId = "ChIJ-gbg", overview = "Main palace", latitude = 37.5001,
            ),
            dto(13, "ko").copy(title = "경복궁 주차장", contentTypeId = "12", googlePlaceId = "ChIJ-gbg", overview = "주차"),
        )
        fun capturedLogs(): ListAppender<ILoggingEvent> =
            ListAppender<ILoggingEvent>().also { appender ->
                appender.start()
                (LoggerFactory.getLogger(AttractionApiReindexTasklet::class.java) as Logger).addAppender(appender)
            }
        fun ListAppender<ILoggingEvent>.pairLine() = list.map { it.formattedMessage }.single { it.startsWith("Alternate pairs:") }

        `when`("짝 스위치가 켜져 있으면") {
            ReflectionTestUtils.setField(tasklet, "alternatePairsEnabled", true)
            val documents = captureDocuments()
            onePage(*pairInputs())
            val logs = capturedLogs()

            tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())
            val sources = documents.associate { it.id to bulkSource(it) }

            then("짝 두 문서가 서로의 id 를 싣고, 짝이 아닌 문서는 필드가 없다") {
                sources.getValue("11")["alternateId"] shouldBe "12"
                sources.getValue("12")["alternateId"] shouldBe "11"
                sources.getValue("13").keys shouldNotContain "alternateId"
            }
            then("짝 수와 간선·탈락 수를 한 줄로 남긴다") {
                logs.pairLine() shouldBe
                    "Alternate pairs: 1 (edges 1, dropped by uniqueness 0, dropped by overview 0, enabled=true)"
            }
            then("본문 변경 시각은 place 값 그대로, 없으면 필드가 없다") {
                sources.getValue("11")["contentUpdatedAt"] shouldBe "2026-10-08T09:10:11"
                sources.getValue("12").keys shouldNotContain "contentUpdatedAt"
            }
        }

        `when`("짝 스위치가 꺼져 있으면") {
            ReflectionTestUtils.setField(tasklet, "alternatePairsEnabled", false)
            val documents = captureDocuments()
            onePage(*pairInputs())
            val logs = capturedLogs()

            tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())
            val sources = documents.associate { it.id to bulkSource(it) }

            then("모든 문서에 alternateId 가 없다") {
                sources.keys shouldBe setOf("11", "12", "13")
                sources.values.forEach { it.keys shouldNotContain "alternateId" }
            }
            then("계산은 그대로 해서 로그의 짝 수가 켜졌을 때와 같다") {
                logs.pairLine() shouldBe
                    "Alternate pairs: 1 (edges 1, dropped by uniqueness 0, dropped by overview 0, enabled=false)"
            }
            then("본문 변경 시각은 스위치와 무관하게 싣는다") {
                sources.getValue("11")["contentUpdatedAt"] shouldBe "2026-10-08T09:10:11"
            }
        }
    }

    given("재색인이 클릭 신호를 붙일 때") {
        fun capturedLogs(): ListAppender<ILoggingEvent> =
            ListAppender<ILoggingEvent>().also { appender ->
                appender.start()
                (LoggerFactory.getLogger(AttractionApiReindexTasklet::class.java) as Logger).addAppender(appender)
            }
        fun ListAppender<ILoggingEvent>.messages() = list.map { it.formattedMessage }

        `when`("ClickHouse 가 14일 고유 클릭 방문자 수를 주면") {
            then("있는 문서는 값과 계수가, 없는 문서는 0 과 1.0 이 bulk 문서에 실려야 한다") {
                val documents = captureDocuments()
                onePage(dto(1, "ko"), dto(2, "ko"))
                val window = slot<ClosedRange<LocalDate>>()
                every { clickReader.loadUniqueClickers(capture(window)) } returns mapOf("1" to 12)
                val logs = capturedLogs()

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                val clicked = bulkSource(documents.single { it.id == "1" })
                clicked["uniqueClickers14d"] shouldBe 12
                (clicked["clickBoost"] as Number).toDouble() shouldBe AttractionClickSignal.boost(12)
                val quiet = bulkSource(documents.single { it.id == "2" })
                quiet["uniqueClickers14d"] shouldBe 0
                (quiet["clickBoost"] as Number).toDouble() shouldBe 1.0
                // 창은 오늘(KST)을 뺀 14일이다
                (window.captured.endInclusive.toEpochDay() - window.captured.start.toEpochDay()) shouldBe 13L
                logs.messages().single { it.startsWith("클릭 신호") } shouldContain "1곳"
            }
        }

        `when`("접속은 되는데 14일 클릭이 하나도 없으면") {
            then("0곳이라고 따로 적는다 — 실패와 구분한다") {
                captureDocuments()
                onePage(dto(1, "ko"))
                val logs = capturedLogs()

                tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                logs.messages().single { it.startsWith("클릭 신호") } shouldContain "0곳"
            }
        }

        `when`("ClickHouse 조회가 실패하면") {
            then("필드를 비우고 계수 1.0 으로 끝까지 색인하며 경고를 남긴다") {
                val documents = captureDocuments()
                onePage(dto(1, "ko"), dto(2, "ko"))
                every { clickReader.loadUniqueClickers(any()) } throws SQLException("Connection refused")
                val logs = capturedLogs()

                val result = tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                result shouldBe RepeatStatus.FINISHED
                documents.size shouldBe 2
                documents.forEach { doc ->
                    bulkSource(doc).keys shouldNotContain "uniqueClickers14d"
                    (bulkSource(doc)["clickBoost"] as Number).toDouble() shouldBe 1.0
                }
                verify { aliasManager.updateAliasAndCleanup("attractions", "attractions_1", maxRetention = 1) }
                logs.list.single { it.formattedMessage.startsWith("클릭 신호") }.level.toString() shouldBe "WARN"
            }
        }
    }
})

private const val MODEL_REF = "microsoft/harrier-oss-v1-270m@abc1234#d640"

/**
 * 태스클릿이 만든 bulk 문서 캡처본. search:app 의 `AttractionReindexCaptureTest` 가 이 파일을 읽기 문서로 역직렬화해
 * `toDomain()` → 검색 결과까지 값이 남는지 본다(손으로 만든 문서가 아니라 쓰기 쪽 산출물). 원천 날짜는 색인에 없어
 * 같은 파일에 함께 둔다 — 읽기 쪽이 [com.kgd.search.domain.attraction.model.EventSchedule] 로 기대값을 다시 계산한다.
 * CI 가 이 테스트를 돌린 뒤 `git diff --exit-code` 로 캡처가 최신인지 본다.
 */
private const val REINDEX_CAPTURE_PATH = "search/app/src/test/resources/attraction/reindex-capture.json"

private fun repoRoot(): File = generateSequence(File("").absoluteFile) { it.parentFile }
    .first { File(it, "settings.gradle.kts").isFile }

/** 2단계 공공데이터 실호출 표본(2026-10-02) — 무장애 상세 원문을 여기서 읽는다. */
private const val PHASE2_SAMPLE_PATH = "docs/specs/2026-10-02-place-tour-portal-expansion/implementation/sample-phase2-apis.json"

private fun writeReindexCapture(
    documents: List<AttractionIndexDocument>,
    inputs: List<PlaceApiClient.AttractionDto>,
    sourceLinks: Map<Long, String>,
    sourceExtras: Map<Long, PlaceApiClient.ExtrasDto>,
) {
    val mapper = jacksonMapperBuilder().disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS).build()
    val capture = mapOf(
        "documents" to documents.sortedBy { it.idSort },
        "sourceDates" to inputs.filter { it.eventStartDate != null || it.eventEndDate != null }.associate {
            it.id.toString() to mapOf("start" to it.eventStartDate?.toString(), "end" to it.eventEndDate?.toString())
        },
        // place 링크 벌크 조회가 준 원문 — 읽기 쪽이 상세 결과의 링크와 견준다
        "sourceLinks" to sourceLinks.mapKeys { it.key.toString() },
        // place 부가 정보 묶음 조회가 준 값 — 읽기 쪽이 도메인 규칙(BarrierFreeInfo.detailOf)으로 기대값을 다시 만든다
        "sourceExtras" to sourceExtras.mapKeys { it.key.toString() },
    )
    val file = repoRoot().resolve(REINDEX_CAPTURE_PATH)
    file.parentFile.mkdirs()
    file.writeText(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(capture) + "\n")
}
