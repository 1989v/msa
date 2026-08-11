package com.kgd.search.job

import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.indexing.AttractionIndexDocument
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
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

    given("관광지 재색인 실행 시") {
        `when`("place API 가 ACTIVE 2건 + 비활성 1건을 반환하면") {
            then("새 인덱스 생성 → ACTIVE 만 색인 → flush → alias swap 순서로 수행해야 한다") {
                every { aliasManager.createTimestampedIndexName("attractions") } returns "attractions_1"
                every { aliasManager.createIndex("attractions_1", IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION) } just Runs
                every { aliasManager.updateAliasAndCleanup("attractions", "attractions_1") } just Runs
                every { bulkProcessor.errorCount } returns AtomicLong(0)
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
    }
})
