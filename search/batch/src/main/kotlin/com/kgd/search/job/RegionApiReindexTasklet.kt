package com.kgd.search.job

import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.indexing.AttractionIndexDocument
import com.kgd.search.infrastructure.indexing.GeoPoint
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import com.kgd.search.infrastructure.indexing.OsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.RegionIndexDocument
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
 * 행정 지역 전체 재색인 (ADR-0065 통합 자동완성) — place regions 풀스캔 → regions alias swap.
 */
@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class RegionApiReindexTasklet(
    private val placeApiClient: PlaceApiClient,
    private val bulkProcessor: OsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) : Tasklet {

    private val log = KotlinLogging.logger {}

    @Value("\${search.index.region-alias:regions}")
    private lateinit var indexAlias: String

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus =
        runBlocking {
            val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
            log.info { "Starting region reindex (API) → $newIndexName" }

            aliasManager.createIndex(newIndexName, IndexAliasManager.REGIONS_INDEX_DEFINITION)

            var page = 0
            var totalPages: Int
            var totalIndexed = 0L

            do {
                val response = placeApiClient.fetchRegionPage(page)
                totalPages = response.totalPages

                response.regions.forEach { region ->
                    val document = RegionIndexDocument(
                        id = region.id.toString(),
                        name = region.name,
                        nameKo = region.nameKo,
                        level = region.level,
                        countryCode = region.countryCode,
                        location = if (region.latitude != null && region.longitude != null) {
                            GeoPoint(lat = region.latitude, lon = region.longitude)
                        } else null,
                        population = region.population ?: 0,
                    )
                    bulkProcessor.processDocument(newIndexName, document.id, document)
                    totalIndexed++
                }

                log.info { "Processed region page ${page + 1}/$totalPages: ${response.regions.size} regions" }
                page++
            } while (page < totalPages)

            bulkProcessor.flush()

            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
            log.info { "Region reindex complete: $totalIndexed docs, ${bulkProcessor.errorCount.get()} errors" }

            RepeatStatus.FINISHED
        }
}
