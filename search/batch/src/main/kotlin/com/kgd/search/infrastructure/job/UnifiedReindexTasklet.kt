package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.client.UnifiedSourceApiClient
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.UnifiedIndexDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.delay
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
            val docs = fetchWithRetry(type) ?: run { failed[type] = lastFailure.getValue(type); continue }
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

    private val lastFailure = mutableMapOf<String, String>()

    /**
     * 한 타입을 [ATTEMPTS] 번까지 받아 본다. 원천은 같은 클러스터의 이웃 파드라 롤아웃·재기동 창에
     * 걸리면 연결이 끊기는데, 그건 몇 초 뒤에 사라지는 상태다. 그때마다 밤 배치를 통째로 버리지 않는다.
     *
     * **실패는 예외까지 남긴다.** 메시지만 모아 두면 「무엇이 왜 끊겼는지」가 사라지고, 잡이 실패한 다음
     * 날 아침에는 파드도 없다(2026-09-14~17 네 번 실패했는데 원인을 되짚을 로그가 남지 않았다).
     */
    private suspend fun fetchWithRetry(type: String): List<UnifiedIndexDocument>? {
        repeat(ATTEMPTS) { attempt ->
            try {
                return sourceClient.fetch(type)
            } catch (e: Exception) {
                lastFailure[type] = "${e.javaClass.simpleName}: ${e.message}"
                val last = attempt == ATTEMPTS - 1
                log.error(e) { "unified: $type 수집 실패 (${attempt + 1}/$ATTEMPTS)${if (last) "" else " — 재시도"}" }
                if (!last) delay(RETRY_DELAY_MS * (attempt + 1))
            }
        }
        return null
    }

    companion object {
        private const val ATTEMPTS = 3
        private const val RETRY_DELAY_MS = 2_000L
    }
}
