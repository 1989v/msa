package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.indexing.AttractionIndexDocument
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.test.util.ReflectionTestUtils
import java.util.concurrent.atomic.AtomicLong

class AttractionApiReindexTaskletTest : BehaviorSpec({
    val placeApiClient = mockk<PlaceApiClient>()
    val bulkProcessor = mockk<OsBulkDocumentProcessor>(relaxed = true)
    val aliasManager = mockk<IndexAliasManager>()
    val tasklet = AttractionApiReindexTasklet(placeApiClient, bulkProcessor, aliasManager).also {
        ReflectionTestUtils.setField(it, "indexAlias", "attractions")
        ReflectionTestUtils.setField(it, "pageSize", 100)
    }

    fun dto(id: Long, lang: String, status: String = "ACTIVE") = PlaceApiClient.AttractionDto(
        id = id, contentId = "c$id", lang = lang, title = "관광지$id",
        latitude = 37.5, longitude = 127.0, category = "history", status = status,
    )

    beforeContainer {
        every { aliasManager.createTimestampedIndexName("attractions") } returns "attractions_1"
        every { aliasManager.createIndex("attractions_1", IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION) } just Runs
        every { aliasManager.updateAliasAndCleanup("attractions", "attractions_1") } just Runs
        every { bulkProcessor.errorCount } returns AtomicLong(0)
    }

    given("관광지 재색인 실행 시") {
        `when`("place API 가 ACTIVE 2건 + 비활성 1건을 반환하면") {
            then("새 인덱스 생성 → ACTIVE 만 색인 → flush → alias swap 순서로 수행해야 한다") {
                coEvery { placeApiClient.fetchPage(0, 100) } returns PlaceApiClient.AttractionPageResponse(
                    attractions = listOf(dto(1, "ko"), dto(2, "en"), dto(3, "ko", status = "INACTIVE")),
                    totalElements = 3, totalPages = 1,
                )

                val result = tasklet.execute(mockk<StepContribution>(), mockk<ChunkContext>())

                result shouldBe RepeatStatus.FINISHED
                verify(exactly = 2) { bulkProcessor.processDocument("attractions_1", any<String>(), any<AttractionIndexDocument>()) }
                verify { bulkProcessor.flush() }
                verify { aliasManager.updateAliasAndCleanup("attractions", "attractions_1") }
            }
        }

        `when`("place 가 파생 표기·완결성 필드를 주면") {
            then("문서 title 은 표시명, titleLocal·idSort·popularityScore 가 실려야 한다") {
                val documents = mutableListOf<AttractionIndexDocument>()
                every { bulkProcessor.processDocument("attractions_1", any<String>(), capture(documents)) } just Runs
                coEvery { placeApiClient.fetchPage(0, 100) } returns PlaceApiClient.AttractionPageResponse(
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
                    totalElements = 2, totalPages = 1,
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
    }
})
