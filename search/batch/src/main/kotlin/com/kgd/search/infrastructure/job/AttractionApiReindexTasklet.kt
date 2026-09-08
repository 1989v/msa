package com.kgd.search.infrastructure.job

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
 *
 * 문서 벡터(ADR-0090)는 페이지마다 place 에서 받아 함께 싣는다. 벡터가 없는 문서는 세 필드가 빈 채로
 * 색인되고 BM25 로만 찾힌다 — **재색인은 벡터를 기다리지 않는다.**
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

    /** 비어 있으면 벡터를 싣지 않는다 — 첫 채움 전에는 이것이 정상 상태다. */
    @Value("\${search.embedding.model-ref:}")
    private lateinit var embeddingModelRef: String

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus =
        runBlocking {
            val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
            log.info { "Starting attraction reindex (API) → $newIndexName" }

            aliasManager.createIndex(newIndexName, IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION)

            val modelRef = embeddingModelRef.trim()
            if (modelRef.isEmpty()) {
                log.info { "search.embedding.model-ref 가 비어 벡터 없이 색인한다 (BM25 전용)" }
            }

            var page = 0
            var totalPages: Int
            var totalIndexed = 0L
            var withVector = 0L

            do {
                val response = placeApiClient.fetchPage(page, pageSize)
                totalPages = response.totalPages

                val active = response.attractions.filter { it.status == "ACTIVE" }
                val embeddings = if (modelRef.isEmpty()) {
                    emptyMap()
                } else {
                    // 한 페이지가 lookup 상한(500)보다 작다는 보장이 없다 — 나눠 부른다.
                    active.map { it.id }.chunked(PlaceApiClient.LOOKUP_MAX_BATCH)
                        .fold(emptyMap<Long, PlaceApiClient.EmbeddingDto>()) { acc, ids ->
                            acc + placeApiClient.lookupEmbeddings(modelRef, ids)
                        }
                }

                active.forEach { attraction ->
                    val embedding = embeddings[attraction.id]?.let {
                        AttractionIndexDocument.Embedding(
                            vector = it.vector,
                            modelRef = modelRef,
                            textHash = it.textHash,
                        )
                    }
                    if (embedding != null) withVector++
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
                            lclsSystm1 = attraction.lclsSystm1,
                            lclsSystm2 = attraction.lclsSystm2,
                            lclsSystm3 = attraction.lclsSystm3,
                            contentTypeId = attraction.contentTypeId,
                            imageUrl = attraction.imageUrl,
                            thumbnailUrl = attraction.thumbnailUrl,
                            tel = attraction.tel,
                            overview = attraction.overview,
                            useTime = attraction.useTime,
                            restDate = attraction.restDate,
                            useFee = attraction.useFee,
                            parking = attraction.parking,
                            parkingFee = attraction.parkingFee,
                            infoCenter = attraction.infoCenter,
                            introRaw = attraction.introRaw,
                            googlePlaceId = attraction.googlePlaceId,
                            modifiedAt = attraction.sourceModifiedAt,
                        ),
                        embedding,
                    )
                    bulkProcessor.processDocument(newIndexName, document.id, document)
                    totalIndexed++
                }

                log.info { "Processed page ${page + 1}/$totalPages: ${response.attractions.size} attractions" }
                page++
            } while (page < totalPages)

            bulkProcessor.flush()

            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
            // 벡터 적재율이 v2 의 건강 지표다(ADR-0090 D7). 낮으면 도구가 안 돌았거나 스탬프가 어긋난 것이다.
            // stale 여부는 여기서 알 수 없다 — 그것은 place `/status` 가 attractions.updated_at 과 견줘 센다.
            log.info {
                "Attraction reindex complete: $totalIndexed docs, ${bulkProcessor.errorCount.get()} errors, " +
                    "vectors $withVector/$totalIndexed" + if (modelRef.isEmpty()) " (model-ref 미설정)" else " ($modelRef)"
            }

            RepeatStatus.FINISHED
        }
}
