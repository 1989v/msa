package com.kgd.search.job

import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.indexing.AttractionIndexDocument
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
 * 관광지 전체 재색인 (ADR-0065) — place API 풀스캔 → attractions alias swap.
 * SSOT(place MySQL)가 배치 주기로만 바뀌는 reference data 라 이벤트 파이프라인 없이 일괄 재구축.
 */
@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class AttractionApiReindexTasklet(
    private val placeApiClient: PlaceApiClient,
    private val bulkProcessor: OsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) : Tasklet {

    private val log = KotlinLogging.logger {}

    @Value("\${search.index.attraction-alias:attractions}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus =
        runBlocking {
            val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
            log.info { "Starting attraction reindex (API) → $newIndexName" }

            aliasManager.createIndex(newIndexName, IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION)

            var page = 0
            var totalPages: Int
            var totalIndexed = 0L

            do {
                val response = placeApiClient.fetchPage(page, pageSize)
                totalPages = response.totalPages

                response.attractions
                    .filter { it.status == "ACTIVE" }
                    .forEach { attraction ->
                        val document = AttractionIndexDocument.fromDomain(
                            AttractionDocument(
                                id = attraction.id.toString(),
                                contentId = attraction.contentId,
                                lang = attraction.lang,
                                // 문서 title 은 표시명이다 — 꼬리 괄호 표기는 titleLocal 로 분리
                                // (place 가 아직 파생 컬럼 없이 응답하면 원문으로 폴백).
                                title = attraction.titleDisplay ?: attraction.title,
                                titleLocal = attraction.titleLocal,
                                latitude = attraction.latitude,
                                longitude = attraction.longitude,
                                address = attraction.address,
                                areaCode = attraction.areaCode,
                                sigunguCode = attraction.sigunguCode,
                                ldongRegnCd = attraction.ldongRegnCd,
                                ldongSignguCd = attraction.ldongSignguCd,
                                category = attraction.category,
                                imageUrl = attraction.imageUrl,
                                tel = attraction.tel,
                                overview = attraction.overview,
                                modifiedAt = attraction.sourceModifiedAt,
                            )
                        )
                        bulkProcessor.processDocument(newIndexName, document.id, document)
                        totalIndexed++
                    }

                log.info { "Processed page ${page + 1}/$totalPages: ${response.attractions.size} attractions" }
                page++
            } while (page < totalPages)

            bulkProcessor.flush()

            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
            log.info { "Attraction reindex complete: $totalIndexed docs, ${bulkProcessor.errorCount.get()} errors" }

            RepeatStatus.FINISHED
        }
}
