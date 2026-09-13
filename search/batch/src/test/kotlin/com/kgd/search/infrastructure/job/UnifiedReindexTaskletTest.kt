package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.client.UnifiedSourceApiClient
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.UnifiedIndexDocument
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.verify
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.test.util.ReflectionTestUtils

/**
 * 한 타입이라도 못 받으면 alias 를 바꾸지 않는다 — 바꾸면 그 타입이 통째로 사라진 인덱스가 서빙된다.
 */
class UnifiedReindexTaskletTest : BehaviorSpec({

    fun doc(type: String, id: String) =
        UnifiedIndexDocument(id = "$type:$id", type = type, sourceId = id, slug = id, lang = "ko", title = id)

    fun tasklet(client: UnifiedSourceApiClient, alias: IndexAliasManager, bulk: OsBulkDocumentProcessor): UnifiedReindexTasklet =
        UnifiedReindexTasklet(client, bulk, alias).also { ReflectionTestUtils.setField(it, "indexAlias", "unified") }

    fun aliasManager(): IndexAliasManager = mockk<IndexAliasManager>().also {
        every { it.createTimestampedIndexName("unified") } returns "unified_20260913"
        every { it.createIndex("unified_20260913", IndexAliasManager.UNIFIED_INDEX_DEFINITION) } just runs
        every { it.updateAliasAndCleanup("unified", "unified_20260913", any()) } just runs
    }

    fun bulk(): OsBulkDocumentProcessor = mockk<OsBulkDocumentProcessor>(relaxed = true)

    given("여섯 타입이 전부 받아지면") {
        val client = mockk<UnifiedSourceApiClient>()
        coEvery { client.fetch(any()) } answers { listOf(doc(firstArg(), "1")) }
        val alias = aliasManager(); val bulk = bulk()

        `when`("재색인하면") {
            val status = tasklet(client, alias, bulk).execute(mockk<StepContribution>(), mockk<ChunkContext>())

            then("여섯 문서를 싣고 alias 를 바꾼다") {
                status shouldBe RepeatStatus.FINISHED
                verify(exactly = UnifiedSourceApiClient.TYPES.size) { bulk.processDocument("unified_20260913", any(), any()) }
                verify(exactly = 1) { alias.updateAliasAndCleanup("unified", "unified_20260913", any()) }
            }
        }
    }

    given("게임 API 가 죽어 있으면") {
        val client = mockk<UnifiedSourceApiClient>()
        coEvery { client.fetch(any()) } answers { listOf(doc(firstArg(), "1")) }
        coEvery { client.fetch(UnifiedSourceApiClient.GAME) } throws IllegalStateException("Connection refused")
        val alias = aliasManager(); val bulk = bulk()

        `when`("재색인하면") {
            val error = shouldThrow<IllegalStateException> {
                tasklet(client, alias, bulk).execute(mockk<StepContribution>(), mockk<ChunkContext>())
            }

            then("잡은 실패하고 alias 는 옛 인덱스에 남는다 — 다른 타입만 실린 인덱스를 서빙하지 않는다") {
                error.message shouldContain "game"
                verify(exactly = 0) { alias.updateAliasAndCleanup(any(), any(), any()) }
            }
        }
    }
})
