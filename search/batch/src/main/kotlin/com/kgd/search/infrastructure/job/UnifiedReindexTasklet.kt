package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.client.UnifiedSourceApiClient
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * 통합 인덱스 재색인 — 관광지를 뺀 여섯 타입을 공개 API 로 풀스캔해 `unified` alias 를 바꿔 단다.
 *
 * **한 타입이라도 못 받으면 alias 를 바꾸지 않는다.** 바꾸면 그 타입이 통째로 사라진 인덱스가
 * 서빙된다 — 옛 인덱스를 그대로 두고 잡을 실패시키는 쪽이 낫다(다음 주기가 다시 시도한다).
 */
@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class UnifiedReindexTasklet(
    private val sourceClient: UnifiedSourceApiClient,
    private val bulkProcessor: OsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager,
) : Tasklet {

    private val log = KotlinLogging.logger {}

    @Value("\${search.index.unified-alias:unified}")
    private lateinit var indexAlias: String

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus = runBlocking {
        val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
        log.info { "Starting unified reindex (API) → $newIndexName" }
        aliasManager.createIndex(newIndexName, IndexAliasManager.UNIFIED_INDEX_DEFINITION)

        val counts = linkedMapOf<String, Int>()
        val failed = linkedMapOf<String, String>()
        for (type in UnifiedSourceApiClient.TYPES) {
            val docs = runCatching { sourceClient.fetch(type) }
                .getOrElse { failed[type] = it.message ?: it.javaClass.simpleName; continue }
            docs.forEach { bulkProcessor.processDocument(newIndexName, it.id, it) }
            counts[type] = docs.size
            log.info { "unified: $type ${docs.size}건" }
        }
        bulkProcessor.flush()

        if (failed.isNotEmpty()) {
            error("unified reindex 중단 — 못 받은 타입 ${failed.keys} (${failed.values.joinToString(" · ")}). alias 는 그대로 둔다")
        }
        aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
        log.info { "Unified reindex complete: ${counts.values.sum()} docs $counts, ${bulkProcessor.errorCount.get()} errors" }
        RepeatStatus.FINISHED
    }
}
