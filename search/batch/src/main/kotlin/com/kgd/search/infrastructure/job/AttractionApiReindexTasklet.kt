package com.kgd.search.infrastructure.job

import com.kgd.search.domain.attraction.model.AttractionAttributeParser
import com.kgd.search.domain.attraction.model.AttractionAttributeSource
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.RegionAggregator
import com.kgd.search.domain.attraction.model.RegionPlacement
import com.kgd.search.domain.attraction.model.RegionProjection
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
import tools.jackson.databind.ObjectMapper

/**
 * 관광지 전체 재색인 (ADR-0065) — place API 풀스캔 → attractions alias swap.
 * SSOT(place MySQL)가 배치 주기로만 바뀌는 reference data 라 이벤트 파이프라인 없이 일괄 재구축.
 *
 * 문서 벡터(ADR-0090)는 페이지마다 place 에서 받아 함께 싣는다. 벡터가 없는 문서는 세 필드가 빈 채로
 * 색인되고 BM25 로만 찾힌다 — **재색인은 벡터를 기다리지 않는다.**
 *
 * place 를 **두 번 훑는다.** 지역 안 위치(같은 시군구·유형 수, 같은 분류 가까운 곳)는 전체를 봐야 셀 수 있는데
 * 문서 전체를 메모리에 들면 배치 힙(약 256MB)을 넘는다. 1차는 가벼운 투영만 모아 집계하고, 2차가 지금처럼
 * 페이지 단위로 색인하면서 집계 결과와 원문에서 뽑은 방문 속성을 붙인다.
 *
 * 두 번 다 id 키셋으로 읽는다(`afterId`). OFFSET 페이지는 건너뛸 행을 전부 읽어 뒤로 갈수록 느려졌고
 * (0쪽 0.5초 → 590쪽 18초), 그대로 두 번 훑으면 CronJob 기한 30분을 넘긴다.
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

            /*
             * 시도 이름표 — 285행이라 **회차당 한 번** 받아 든다 (ADR-0095).
             * 화면이 이걸 받아 코드 하나를 이름으로 바꾸던 호출을 없애려는 것이므로,
             * 색인 쪽에서 관광지마다 부르면 본말전도다.
             */
            val sidoNames = LANGS.associateWith { lang ->
                runCatching { placeApiClient.fetchSidoNames(lang) }.getOrElse { emptyMap() }
            }
            // 시군구·분류 이름표도 같은 이유로 회차당 한 번. 못 받으면 이름만 비고 수·가까운 곳은 싣는다.
            val sigunguNames = runCatching { placeApiClient.fetchSigunguNames() }.getOrElse { e ->
                log.warn(e) { "시군구 이름표를 못 받아 sigunguName 없이 색인한다" }
                emptyMap()
            }
            val categoryNames = LANGS.associateWith { lang ->
                runCatching { placeApiClient.fetchCategoryNames(lang) }.getOrElse { e ->
                    log.warn(e) { "분류 이름표($lang)를 못 받아 lclsSystm3Name 없이 색인한다" }
                    emptyMap()
                }
            }

            val placements = collectRegionPlacements()

            val indexStartedAt = System.nanoTime()

            var page = 0
            var afterId: Long? = 0L
            var totalIndexed = 0L
            var withVector = 0L
            var withRegion = 0L
            var unreadableIntro = 0L

            while (afterId != null) {
                val response = placeApiClient.fetchPageAfter(afterId, pageSize)
                afterId = response.nextAfterId

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

                // 링크도 페이지 단위로 한 번에 받는다 — 관광지마다 부르면 6만 번이다.
                val links = active.map { it.id }.chunked(PlaceApiClient.LOOKUP_MAX_BATCH)
                    .fold(emptyMap<Long, String>()) { acc, ids ->
                        acc + runCatching { placeApiClient.lookupLinks(ids) }.getOrElse { emptyMap() }
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
                    val intro = readIntro(attraction.introRaw)
                    if (intro == null) unreadableIntro++
                    val attributes = AttractionAttributeParser.parse(
                        AttractionAttributeSource(
                            restDate = attraction.restDate,
                            parking = attraction.parking,
                            useFee = attraction.useFee,
                            petAcmpyType = attraction.petAcmpyType,
                            intro = intro.orEmpty(),
                        ),
                    )
                    val region = placements[attraction.id.toString()]?.let { placement ->
                        withRegion++
                        regionOf(attraction, placement, sigunguNames, categoryNames)
                    }
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
                            petAcmpyType = attraction.petAcmpyType,
                            setting = attraction.setting,
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
                            imagesRaw = attraction.imagesRaw,
                            infoRaw = attraction.infoRaw,
                            // 행정구역 시도 코드는 법정동 2자리다 (ADR-0071).
                            sidoName = attraction.ldongRegnCd
                                ?.let { sidoNames[attraction.lang]?.get(it) },
                            links = links[attraction.id],
                            googlePlaceId = attraction.googlePlaceId,
                            modifiedAt = attraction.sourceModifiedAt,
                            attributes = attributes,
                            region = region,
                        ),
                        embedding,
                    )
                    bulkProcessor.processDocument(newIndexName, document.id, document)
                    totalIndexed++
                }

                page++
                log.info { "Processed page $page (next afterId=$afterId): ${response.attractions.size} attractions" }
            }

            bulkProcessor.flush()

            // 관광지 색인은 한 벌 272 MB(벡터 153 MB 포함)라 두 벌을 두면 옛 벌이 페이지 캐시를 나눠 먹는다 —
            // kNN 은 그래프·벡터 파일이 캐시에 다 있어야 빨라서(없으면 질의당 100초대) 살아 있는 한 벌만 남긴다.
            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName, maxRetention = 1)
            // 벡터 적재율이 v2 의 건강 지표다(ADR-0090 D7). 낮으면 도구가 안 돌았거나 스탬프가 어긋난 것이다.
            // stale 여부는 여기서 알 수 없다 — 그것은 place `/status` 가 attractions.updated_at 과 견줘 센다.
            log.info {
                "Attraction reindex complete: $totalIndexed docs, ${bulkProcessor.errorCount.get()} errors, " +
                    "vectors $withVector/$totalIndexed" + (if (modelRef.isEmpty()) " (model-ref 미설정)" else " ($modelRef)") +
                    ", region $withRegion/$totalIndexed, unreadable introRaw $unreadableIntro, " +
                    "attribute parser v${AttractionAttributeParser.VERSION}, index pass ${elapsedMs(indexStartedAt)}ms"
            }

            RepeatStatus.FINISHED
        }

    /**
     * 1차 훑기 — 색인할 문서(ACTIVE)의 투영만 모아 지역 안 위치를 센다. 벡터·링크는 부르지 않는다.
     *
     * 투영은 문서당 약 200B 다: 언어·시도·시군구·유형·분류 코드는 종류가 수백 개뿐이라 intern 으로 한 벌만 두고,
     * 문서마다 새로 드는 것은 id·제목·좌표뿐이다. 6만 건이면 약 12MB, 집계 결과(가까운 곳 5건씩)까지 약 30MB.
     */
    private suspend fun collectRegionPlacements(): Map<String, RegionPlacement> {
        val startedAt = System.nanoTime()
        val projections = ArrayList<RegionProjection>()
        var page = 0
        var afterId: Long? = 0L
        while (afterId != null) {
            val response = placeApiClient.fetchPageAfter(afterId, pageSize)
            afterId = response.nextAfterId
            response.attractions.filter { it.status == "ACTIVE" }.mapTo(projections) { it.toProjection() }
            page++
        }

        val placements = RegionAggregator.aggregate(projections)
        log.info {
            "Region pass: ${projections.size} projections over $page pages → ${placements.size} placements " +
                "(${projections.size - placements.size} without sigungu/type), ${elapsedMs(startedAt)}ms"
        }
        return placements
    }

    private fun PlaceApiClient.AttractionDto.toProjection() = RegionProjection(
        id = id.toString(),
        lang = lang.intern(),
        ldongRegnCd = ldongRegnCd?.intern(),
        ldongSignguCd = ldongSignguCd?.intern(),
        contentTypeId = contentTypeId?.intern(),
        lclsSystm3 = lclsSystm3?.intern(),
        latitude = latitude,
        longitude = longitude,
        // 가까운 곳 목록에 나가는 이름이라 색인 문서 title 과 같은 표시명을 쓴다
        title = titleDisplay ?: title,
    )

    private fun regionOf(
        attraction: PlaceApiClient.AttractionDto,
        placement: RegionPlacement,
        sigunguNames: Map<String, Map<String, String>>,
        categoryNames: Map<String, Map<String, String>>,
    ) = AttractionRegion(
        // 집계기가 결과를 냈다면 두 코드가 다 있다. 이름표 키는 시도 2자리 + 시군구 3자리다.
        sigunguName = sigunguNames[attraction.lang]?.get("${attraction.ldongRegnCd}${attraction.ldongSignguCd}"),
        typeCount = placement.typeCount,
        categoryCount = placement.categoryCount,
        categoryName = placement.categoryCount?.let { attraction.lclsSystm3?.let { categoryNames[attraction.lang]?.get(it) } },
        sameCategoryNearby = placement.nearest,
    )

    /**
     * introRaw(TourAPI 소개 원문 JSON) → 키·값. 신용카드·유모차 대여 키만 쓴다.
     * 원문이 없으면 빈 맵, 깨져 있으면 null — 깨진 원문은 두 속성이 UNKNOWN 이 되고 건수를 로그에 남긴다.
     */
    private fun readIntro(raw: String?): Map<String, String?>? {
        if (raw.isNullOrBlank()) return emptyMap()
        val node = runCatching { introReader.readTree(raw) }.getOrNull()?.takeIf { it.isObject } ?: return null
        return node.properties().associate { (key, value) -> key to value.takeIf { it.isValueNode && !it.isNull }?.asString() }
    }

    private fun elapsedMs(startedAt: Long) = (System.nanoTime() - startedAt) / 1_000_000

    companion object {
        private val LANGS = listOf("ko", "en")
        private val introReader = ObjectMapper()
    }
}
