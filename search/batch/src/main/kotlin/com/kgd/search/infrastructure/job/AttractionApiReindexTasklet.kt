package com.kgd.search.infrastructure.job

import com.kgd.search.domain.attraction.model.AlternateLanguagePairer
import com.kgd.search.domain.attraction.model.AttractionAttributeParser
import com.kgd.search.domain.attraction.model.AttractionAttributeSource
import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionFee
import com.kgd.search.domain.attraction.model.AttractionKey
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.AttractionSaveSignal
import com.kgd.search.domain.attraction.model.BarrierFreeInfo
import com.kgd.search.domain.attraction.model.CongestionDay
import com.kgd.search.domain.attraction.model.CourseStopsParse
import com.kgd.search.domain.attraction.model.CourseStopsParser
import com.kgd.search.domain.attraction.model.EventDateIssue
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.RegionAggregator
import com.kgd.search.domain.attraction.model.RegionPlacement
import com.kgd.search.domain.attraction.model.RegionProjection
import com.kgd.search.domain.attraction.model.RelatedPlace
import com.kgd.search.domain.attraction.model.SamePlace
import com.kgd.search.domain.attraction.model.SamePlaceGrouper
import com.kgd.search.domain.attraction.model.SimilarPlace
import com.kgd.search.domain.attraction.model.WellnessTheme
import com.kgd.search.infrastructure.client.PlaceApiClient
import com.kgd.search.infrastructure.client.WishlistApiClient
import com.kgd.search.infrastructure.clicksignal.ClickHouseClickSignalReader
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
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

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
 * 1차 투영은 「비슷한 곳」에도 쓴다 — place 목록의 id 가 이번 회차에 활성인지, 그 제목·시도가 무엇인지를
 * 추가 호출 없이 안다. 비활성·삭제 문서를 가리키는 목록 항목은 여기서 빠진다.
 *
 * 1차 투영은 코스 구성 매칭에도 쓴다 — `(lang, contentId) → id` 지도를 만들어 2차가 추가 조회 없이 지점을 잇는다.
 * 행사는 재색인일(KST) 기준으로 끝났거나 날짜가 없으면 가까운 곳·비슷한 곳 후보와 지역 건수에서 빠진다
 * ([EventSchedule.listable]). 항목에는 유효 종료일을 실어 렌더·화면이 그 뒤 끝난 항목을 한 번 더 거른다.
 *
 * 두 번 다 id 키셋으로 읽는다(`afterId`). OFFSET 페이지는 건너뛸 행을 전부 읽어 뒤로 갈수록 느려졌고
 * (0쪽 0.5초 → 590쪽 18초), 그대로 두 번 훑으면 CronJob 기한 30분을 넘긴다.
 */
@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class AttractionApiReindexTasklet(
    private val placeApiClient: PlaceApiClient,
    private val bulkProcessor: OsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager,
    private val clickSignalReader: ClickHouseClickSignalReader,
    private val wishlistApiClient: WishlistApiClient,
    /** 재색인일(KST) — 끝난 행사를 후보·건수에서 거르는 기준. */
    private val clock: Clock = Clock.systemUTC(),
) : Tasklet {

    private val log = KotlinLogging.logger {}

    @Value("\${search.index.attraction-alias:attractions}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    /** 비어 있으면 벡터를 싣지 않는다 — 첫 채움 전에는 이것이 정상 상태다. */
    @Value("\${search.embedding.model-ref:}")
    private lateinit var embeddingModelRef: String

    /**
     * 언어 대체 짝을 문서에 실을지. 꺼져 있어도 짝은 계산해 로그에 남긴다 — 켜기 전에 운영 짝 수를 볼 수 있게.
     * 상세 hreflang 은 문서의 alternateId 만 보므로 꺼져 있으면 하나도 나가지 않는다.
     */
    @Value("\${search.alternate-pairs.enabled:false}")
    private var alternatePairsEnabled: Boolean = false

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

            val uniqueClickers = loadClickSignal()
            val savedCounts = loadSaveSignal()

            val today = EventSchedule.todayKst(clock.instant())
            val (projections, placements, attractionIds, samePlaces, alternates) = collectRegionPlacements(today)

            val indexStartedAt = System.nanoTime()

            var page = 0
            var afterId: Long? = 0L
            var totalIndexed = 0L
            var withVector = 0L
            var withRegion = 0L
            var unreadableIntro = 0L
            var withSimilar = 0L
            var similarModelMismatch = 0L
            var similarLookupFailures = 0L
            var withEventPeriod = 0L
            var eventDatesInverted = 0L
            var eventDatesMissing = 0L
            var withCourseStops = 0L
            var unreadableCourse = 0L
            var unmatchedCourseStops = 0L
            var withBarrierFree = 0L
            var unreadableBarrierFree = 0L
            var withWellness = 0L
            var withCongestion = 0L
            var unreadableCongestionDays = 0L
            var withRelated = 0L
            var relatedNotActive = 0L
            var extrasLookupFailures = 0L
            var linksLookupFailures = 0L
            var withSaved = 0L

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

                // 비슷한 곳도 페이지 단위. 목록은 벡터 스탬프에 묶여 있어 스탬프가 없으면 부르지 않는다.
                // 못 받으면 그 쪽의 목록만 비고 색인은 이어 간다 — 부가 섹션 하나로 재색인을 멈추지 않는다.
                val similar = if (modelRef.isEmpty()) {
                    emptyMap()
                } else {
                    active.map { it.id }.chunked(PlaceApiClient.LOOKUP_MAX_BATCH)
                        .fold(emptyMap<Long, PlaceApiClient.SimilarDto>()) { acc, ids ->
                            acc + runCatching { placeApiClient.lookupSimilar(modelRef, ids) }.getOrElse { e ->
                                similarLookupFailures++
                                log.warn(e) { "비슷한 곳 조회 실패(${ids.size}건) — 이 묶음은 목록 없이 색인한다" }
                                emptyMap()
                            }
                        }
                }

                // 링크도 페이지 단위로 한 번에 받는다 — 관광지마다 부르면 6만 번이다.
                val links = active.map { it.id }.chunked(PlaceApiClient.LOOKUP_MAX_BATCH)
                    .fold(emptyMap<Long, String>()) { acc, ids ->
                        acc + runCatching { placeApiClient.lookupLinks(ids) }.getOrElse { e ->
                            linksLookupFailures++
                            log.warn(e) { "링크 조회 실패(${ids.size}건) — 이 묶음은 링크 없이 색인한다" }
                            emptyMap()
                        }
                    }

                // 부가 정보(무장애 · 웰니스)도 페이지 단위로 한 번에. 못 받으면 그 묶음만 비고 색인은 이어 간다.
                val extras = active.map { it.id }.chunked(PlaceApiClient.LOOKUP_MAX_BATCH)
                    .fold(emptyMap<Long, PlaceApiClient.ExtrasDto>()) { acc, ids ->
                        acc + runCatching { placeApiClient.lookupExtras(ids) }.getOrElse { e ->
                            extrasLookupFailures++
                            log.warn(e) { "부가 정보 조회 실패(${ids.size}건) — 이 묶음은 무장애·웰니스 없이 색인한다" }
                            emptyMap()
                        }
                    }

                active.forEach { attraction ->
                    val extra = extras[attraction.id]
                    val barrierFree = extra?.let { barrierFreeOf(it) { unreadableBarrierFree++ } }
                    if (barrierFree != null) withBarrierFree++
                    val wellness = extra?.wellnessThemeCode?.takeIf { it.isNotBlank() }?.let { code ->
                        withWellness++
                        WellnessTheme(code, categoryNames[attraction.lang]?.get(code))
                    }
                    val congestion = extra?.congestion?.let { congestionOf(it) { unreadableCongestionDays++ } }
                    if (congestion != null) withCongestion++
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
                    // 요금 텍스트는 한 번만 계산해 입장 판정과 문서에 같은 값을 넘긴다 — 둘이 다르면 표시와 필터가 갈린다
                    val feeText = AttractionFee.text(attraction.useFee, readInfo(attraction.infoRaw))
                    val attributes = AttractionAttributeParser.parse(
                        AttractionAttributeSource(
                            restDate = attraction.restDate,
                            parking = attraction.parking,
                            feeText = feeText,
                            petAcmpyType = attraction.petAcmpyType,
                            intro = intro.orEmpty(),
                        ),
                    )
                    val region = placements[attraction.id.toString()]?.let { placement ->
                        withRegion++
                        regionOf(attraction, placement, sigunguNames, categoryNames)
                    }
                    val similarElsewhere = similar[attraction.id]
                        ?.takeIf { dto ->
                            (dto.modelRef == modelRef).also { same -> if (!same) similarModelMismatch++ }
                        }
                        ?.ids
                        ?.mapNotNull { projections[it.toString()] }
                        ?.map { p ->
                            SimilarPlace(p.id, p.title, p.ldongRegnCd?.let { sidoNames[p.lang]?.get(it) }, p.eventPeriod?.end)
                        }
                        ?.takeIf { it.isNotEmpty() }
                    if (similarElsewhere != null) withSimilar++
                    // 함께 간 곳 — 비슷한 곳과 같은 이름표(projections)로 지금 제목·시도를 붙이고, 활성 문서가 아닌 대상은 뺀다
                    val relatedPlaces = extra?.relatedPlaces
                        ?.let { relatedOf(attraction.id, attraction.lang, it, projections, sidoNames) { relatedNotActive++ } }
                    if (relatedPlaces != null) withRelated++
                    val eventPeriod = attraction.eventPeriod()
                    if (EventSchedule.isEvent(attraction.contentTypeId)) {
                        when (EventSchedule.dateIssue(attraction.eventStartDate, attraction.eventEndDate)) {
                            EventDateIssue.INVERTED -> eventDatesInverted++
                            EventDateIssue.MISSING -> eventDatesMissing++
                            null -> withEventPeriod++
                        }
                    }
                    val course = if (attraction.contentTypeId == CourseStopsParser.COURSE_CONTENT_TYPE) {
                        courseStopsOf(attraction, attractionIds)
                    } else {
                        null
                    }
                    if (course?.warning != null) unreadableCourse++
                    val courseStops = course?.stops?.takeIf { it.isNotEmpty() }?.also { stops ->
                        withCourseStops++
                        unmatchedCourseStops += stops.count { it.attractionId == null }
                    }
                    // 찜은 언어 문서 id 단위다 — 국·영 찜을 합치지 않는다. 하한 미만은 싣지 않는다(집계가 이미 걸렀어도 한 번 더)
                    val savedCount = savedCounts?.get(attraction.id.toString())?.takeIf { AttractionSaveSignal.meetsMin(it) }
                    if (savedCount != null) withSaved++
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
                            camping = extra?.camping,
                            googlePlaceId = attraction.googlePlaceId,
                            modifiedAt = attraction.sourceModifiedAt,
                            source = attraction.source,
                            copyrightDivCd = attraction.copyrightDivCd,
                            feeText = feeText,
                            attributes = attributes,
                            region = region,
                            similarElsewhere = similarElsewhere,
                            // 신호를 읽었으면 없는 관광지는 0(클릭 없음), 못 읽었으면 비운다(모름)
                            uniqueClickers14d = uniqueClickers?.let { it[attraction.id.toString()] ?: 0 },
                            savedCount = savedCount,
                            // 근거 줄의 「{날짜} 기준」 — 찜·클릭을 이 회차에 읽었다는 날짜다
                            signalsAsOf = today,
                            eventPeriod = eventPeriod,
                            courseStops = courseStops,
                            barrierFree = barrierFree,
                            wellness = wellness,
                            congestion = congestion,
                            relatedPlaces = relatedPlaces,
                            samePlace = samePlaces[attraction.id.toString()],
                            contentUpdatedAt = attraction.contentUpdatedAt,
                            alternateId = if (alternatePairsEnabled) alternates[attraction.id.toString()] else null,
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
                    ", region $withRegion/$totalIndexed, similar $withSimilar/$totalIndexed " +
                    "(model_ref mismatch $similarModelMismatch, lookup failures $similarLookupFailures), " +
                    "unreadable introRaw $unreadableIntro, " +
                    // 행사: 유효 기간 적재 · 원천 S>E · 날짜 없음(둘 다 UNKNOWN). 코스: 구성 적재 · 원문 해석 실패 · 링크 못 단 지점
                    "events (today $today) period $withEventPeriod, S>E $eventDatesInverted, no date $eventDatesMissing, " +
                    "courses stops $withCourseStops, unreadable infoRaw $unreadableCourse, unmatched stops $unmatchedCourseStops, " +
                    // 부가 정보: 무장애 적재 · 상세 원문 해석 실패 · 웰니스 적재 · 조회 실패 묶음
                    "barrier-free $withBarrierFree (unreadable $unreadableBarrierFree), wellness $withWellness, " +
                    "congestion $withCongestion (unreadable days $unreadableCongestionDays), " +
                    "related $withRelated (not active $relatedNotActive), " +
                    "extras lookup failures $extrasLookupFailures, " +
                    "links lookup failures $linksLookupFailures, " +
                    "saved $withSaved (min ${AttractionSaveSignal.SAVED_MIN}${if (savedCounts == null) ", load failed" else ""}), " +
                    "attribute parser v${AttractionAttributeParser.VERSION}, index pass ${elapsedMs(indexStartedAt)}ms"
            }

            RepeatStatus.FINISHED
        }

    /**
     * 클릭 신호 — 회차당 한 번, analytics 집계 표에서 14일 고유 클릭 방문자 수를 읽는다 (ADR-0095 §6).
     * 못 읽으면 null 을 돌려 필드를 비우고 색인은 이어 간다 — 부가 신호 하나로 재색인을 멈추지 않는다.
     *
     * 사람 이벤트가 아직 적어 0곳이 정상값처럼 보일 수 있다. 그래서 실패(WARN)와 0곳(INFO)을 다른 줄로 남긴다 —
     * 접속 설정이 빠진 채 매일 조용히 빈 값이 되는 것을 로그로 가를 수 있어야 한다.
     */
    private fun loadClickSignal(): Map<String, Int>? {
        val window = AttractionClickSignal.windowOf(Instant.now())
        return runCatching { clickSignalReader.loadUniqueClickers(window) }
            .onSuccess { loaded ->
                if (loaded.isEmpty()) {
                    log.info { "클릭 신호 0곳 — ClickHouse 는 읽었지만 $window 에 고유 클릭 방문자가 있는 관광지가 없다" }
                } else {
                    log.info {
                        "클릭 신호 ${loaded.size}곳 적재 ($window), " +
                            "최소 표본(${AttractionClickSignal.MIN_SAMPLE}) 이상 ${loaded.values.count { it >= AttractionClickSignal.MIN_SAMPLE }}곳"
                    }
                }
            }
            .onFailure { e -> log.warn(e) { "클릭 신호를 못 읽어 uniqueClickers14d 없이 색인한다 (clickBoost 1.0)" } }
            .getOrNull()
    }

    /**
     * 찜 신호 — 회차당 한 번, wishlist 내부 집계에서 관광지(언어 문서 id)별 찜 수를 [AttractionSaveSignal.SAVED_MIN] 이상만 읽는다.
     * 못 읽으면 null 을 돌려 필드를 비우고 색인은 이어 간다 — 찜이 없어도 상세는 성립한다. 실패는 WARN, 요약 줄에도 남긴다.
     */
    private suspend fun loadSaveSignal(): Map<String, Int>? =
        runCatching { wishlistApiClient.fetchTargetCounts(SAVE_TARGET_TYPE, AttractionSaveSignal.SAVED_MIN) }
            .onSuccess { loaded -> log.info { "찜 신호 ${loaded.size}곳 적재 (하한 ${AttractionSaveSignal.SAVED_MIN}명 이상)" } }
            .onFailure { e -> log.warn(e) { "찜 신호를 못 읽어 savedCount 없이 색인한다" } }
            .getOrNull()

    /**
     * 1차 훑기 — 색인할 문서(ACTIVE)의 투영만 모아 지역 안 위치를 센다. 벡터·링크는 부르지 않는다.
     *
     * 투영은 문서당 약 200B 다: 언어·시도·시군구·유형·분류 코드는 종류가 수백 개뿐이라 intern 으로 한 벌만 두고,
     * 문서마다 새로 드는 것은 id·제목·좌표뿐이다. 6만 건이면 약 12MB, 집계 결과(가까운 곳 5건씩)까지 약 30MB.
     * 언어 대체 짝 판정용 place_id·로컬명은 응답 문자열을 그대로 가리켜 문서당 참조 몇 개만 는다.
     */
    private suspend fun collectRegionPlacements(today: LocalDate): RegionPass {
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

        // 코스 지점은 끝난 행사여도 같은 관광지 문서라 잇는다 — 거르는 것은 후보·건수뿐이다.
        val attractionIds = HashMap<AttractionKey, Long>(projections.size * 2)
        projections.forEach { attractionIds[AttractionKey(it.lang, it.contentId)] = it.id.toLong() }
        val listed = projections.filter { EventSchedule.listable(it.contentTypeId, it.eventPeriod, today) }
        // 끝난 행사 자신도 지역 안 위치(허브 링크·수·가까운 곳)는 갖는다 — 다만 수와 후보는 listed 로만 센다
        val placements = RegionAggregator.aggregate(candidates = listed, targets = projections)
        log.info {
            "Region pass: ${projections.size} projections over $page pages → ${placements.size} placements " +
                "(${projections.size - placements.size} without sigungu/type, " +
                "${projections.size - listed.size} ended/undated events left out as of $today), ${elapsedMs(startedAt)}ms"
        }
        // 같은 장소의 다른 등록 — 끝난 행사는 잇지 않는다(listed 만)
        val samePlaces = SamePlaceGrouper.group(listed)
        log.info { "Same place: ${samePlaces.size} documents have another listing of the same place" }
        // 언어 대체 짝 — 전체 활성 투영으로 판정한다(행사·코스는 판정기가 뺀다). 스위치와 무관하게 계산·로그한다
        val alternates = AlternateLanguagePairer.pair(projections)
        log.info {
            "Alternate pairs: ${alternates.pairCount} (edges ${alternates.edges}, " +
                "dropped by uniqueness ${alternates.droppedByUniqueness}, dropped by overview ${alternates.droppedByOverview}, " +
                "enabled=$alternatePairsEnabled)"
        }
        return RegionPass(listed.associateBy { it.id }, placements, attractionIds, samePlaces, alternates.pairs)
    }

    /**
     * 1차 훑기 결과 — 후보가 될 수 있는 활성 문서의 투영(id 키), 지역 집계, 코스 매칭 지도, 같은 장소 묶음, 언어 대체 짝.
     * 끝난 행사는 [projections] 에 없어 비슷한 곳 항목에서도 빠진다.
     */
    private data class RegionPass(
        val projections: Map<String, RegionProjection>,
        val placements: Map<String, RegionPlacement>,
        val attractionIds: Map<AttractionKey, Long>,
        val samePlaces: Map<String, List<SamePlace>>,
        /** 언어 대체 짝 id → 상대 id(양방향). 스위치가 꺼져 있어도 채워진다 — 문서에 실을지는 2차가 정한다. */
        val alternates: Map<String, String>,
    )

    /** 행사만 유효 기간을 갖는다 — 다른 유형에 날짜가 실려 와도 행사 규칙을 적용하지 않는다. */
    private fun PlaceApiClient.AttractionDto.eventPeriod(): EventPeriod? =
        if (EventSchedule.isEvent(contentTypeId)) EventSchedule.effectivePeriod(eventStartDate, eventEndDate) else null

    /**
     * 여행코스 infoRaw → 구성 지점. 원문이 비었으면 null. 해석하지 못하면 경고가 있고 지점은 비어 있다 —
     * 일부만 읽힌 순서를 맞는 코스처럼 싣지 않는다.
     */
    private fun courseStopsOf(attraction: PlaceApiClient.AttractionDto, attractionIds: Map<AttractionKey, Long>): CourseStopsParse? {
        val raw = attraction.infoRaw?.takeIf { it.isNotBlank() } ?: return null
        val parsed = runCatching { introReader.readValue(raw, Any::class.java) }
            .fold(
                onSuccess = { CourseStopsParser.parse(it, attraction.lang, attractionIds) },
                onFailure = { e -> CourseStopsParse(emptyList(), "JSON 이 아니다: ${e.message}") },
            )
        parsed.warning?.let { log.warn { "코스 구성 해석 실패 (id=${attraction.id}): $it" } }
        return parsed
    }

    private fun PlaceApiClient.AttractionDto.toProjection() = RegionProjection(
        id = id.toString(),
        contentId = contentId,
        lang = lang.intern(),
        ldongRegnCd = ldongRegnCd?.intern(),
        ldongSignguCd = ldongSignguCd?.intern(),
        contentTypeId = contentTypeId?.intern(),
        lclsSystm3 = lclsSystm3?.intern(),
        latitude = latitude,
        longitude = longitude,
        // 가까운 곳 목록에 나가는 이름이라 색인 문서 title 과 같은 표시명을 쓴다
        title = titleDisplay ?: title,
        sourceTitle = title,
        eventPeriod = eventPeriod(),
        googlePlaceId = googlePlaceId,
        titleLocal = titleLocal,
        // 서버 렌더가 noindex 로 판정하는 기준(개요 비었음)과 같다
        hasOverview = !overview.isNullOrEmpty(),
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

    /** infoRaw(반복정보 원문 JSON) → 푼 값. 비었거나 JSON 이 아니면 null — 요금은 use_fee 만으로 정한다. */
    private fun readInfo(raw: String?): Any? =
        raw?.takeIf { it.isNotBlank() }?.let { runCatching { introReader.readValue(it, Any::class.java) }.getOrNull() }

    /**
     * introRaw(TourAPI 소개 원문 JSON) → 키·값. 신용카드·유모차 대여 키만 쓴다.
     * 원문이 없으면 빈 맵, 깨져 있으면 null — 깨진 원문은 두 속성이 UNKNOWN 이 되고 건수를 로그에 남긴다.
     */
    private fun readIntro(raw: String?): Map<String, String?>? {
        if (raw.isNullOrBlank()) return emptyMap()
        val node = runCatching { introReader.readTree(raw) }.getOrNull()?.takeIf { it.isObject } ?: return null
        return node.properties().associate { (key, value) -> key to value.takeIf { it.isValueNode && !it.isNull }?.asString() }
    }

    /**
     * 무장애 원천 → 도메인. 코드도 문장도 없으면 null. 상세 원문을 못 읽으면 코드만 싣고 [onUnreadable] 로 센다 —
     * 코드는 수집기가 같은 원문에서 만든 값이라 남길 수 있다.
     */
    private fun barrierFreeOf(dto: PlaceApiClient.ExtrasDto, onUnreadable: () -> Unit): BarrierFreeInfo? {
        val detail = dto.barrierFreeDetailRaw?.takeIf { it.isNotBlank() }?.let { raw ->
            readIntro(raw) ?: run {
                onUnreadable()
                emptyMap()
            }
        }.orEmpty()
        val info = BarrierFreeInfo(dto.barrierFreeFlags.orEmpty(), BarrierFreeInfo.detailOf(detail))
        return info.takeIf { it.flags.isNotEmpty() || it.detail.isNotEmpty() }
    }

    /** 집중률 원천 → 도메인(예측일 순). 날짜를 못 읽는 날은 빼고 [onUnreadable] 로 센다. 남는 날이 없으면 null. */
    private fun congestionOf(days: List<PlaceApiClient.CongestionDayDto>, onUnreadable: () -> Unit): List<CongestionDay>? =
        days.mapNotNull { day ->
            runCatching { LocalDate.parse(day.date) }.getOrNull()?.let { CongestionDay(it, day.rate) } ?: run {
                onUnreadable()
                null
            }
        }.sortedBy { it.date }.takeIf { it.isNotEmpty() }

    /**
     * 연관 관광지 → 도메인. place 가 고른 순서(원천 순위 순)를 지키고, 이름표에 없는(비활성·삭제·끝난 행사) 대상과 다른 언어 문서는
     * 빼며 [onNotActive] 로 센다. 자기 자신·겹친 id 도 뺀다. 남는 앞의 [RelatedPlace.MAX] 건만, 하나도 없으면 null.
     */
    private fun relatedOf(
        selfId: Long,
        lang: String,
        places: List<PlaceApiClient.RelatedPlaceDto>,
        projections: Map<String, RegionProjection>,
        sidoNames: Map<String, Map<String, String>>,
        onNotActive: () -> Unit,
    ): List<RelatedPlace>? =
        places.asSequence()
            .filter { it.attractionId != selfId }
            .distinctBy { it.attractionId }
            .mapNotNull { dto ->
                projections[dto.attractionId.toString()]
                    ?.takeIf { it.lang == lang }
                    ?.let { p -> RelatedPlace(dto.rank, p.id, p.title, p.ldongRegnCd?.let { sidoNames[p.lang]?.get(it) }, dto.category) }
                    ?: run {
                        onNotActive()
                        null
                    }
            }
            .take(RelatedPlace.MAX)
            .toList()
            .takeIf { it.isNotEmpty() }

    private fun elapsedMs(startedAt: Long) = (System.nanoTime() - startedAt) / 1_000_000

    companion object {
        private val LANGS = listOf("ko", "en")

        /** wishlist 찜 대상 종류 — 관광지. 대상 키는 관광지 언어 문서 id 다. */
        private const val SAVE_TARGET_TYPE = "ATTRACTION"
        private val introReader = ObjectMapper()
    }
}
