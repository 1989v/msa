package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.QueryIntent
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * 관광지 검색 (ADR-0065 P1) — BM25 관련도 + geo 반경/거리순. 랭킹 신호(function_score)는 P2.
 * 자동완성은 지역(행정 계층)+관광지 통합 (P2 슬라이스 1).
 */
@Service
class SearchAttractionService(
    private val attractionSearchPort: AttractionSearchPort,
    private val resolveQueryVector: ResolveQueryVectorUseCase,
    private val categoryLexicon: CategoryLexiconPort,
    private val hybrid: AttractionHybridProperties,
    private val queryVector: QueryVectorProperties,
    meterRegistry: MeterRegistry,
) : SearchAttractionUseCase, SuggestAttractionUseCase {

    /** 벡터 레그가 실제로 켜진 요청 수. 사전 적중률(`search.qvec.*`)과 나눠 본다 — 여기가 낮으면 사전이 얇다. */
    private val hybridCounter = meterRegistry.counter("search.attraction.hybrid")
    private val bm25Counter = meterRegistry.counter("search.attraction.bm25")

    /** 질의 이해가 의도어를 필터로 옮긴 요청 수. 사전이 실제로 무는지 보는 값이다. */
    private val intentCounter = meterRegistry.counter("search.attraction.intent")

    override fun execute(prefix: String, lang: String?, size: Int): List<SuggestAttractionUseCase.Suggestion> =
        attractionSearchPort.suggest(prefix, lang?.takeIf { it.isNotBlank() }, size).map { hit ->
            SuggestAttractionUseCase.Suggestion(
                type = hit.type.name,
                id = hit.id,
                title = hit.title,
                titleLocal = hit.titleLocal,
                latitude = hit.latitude,
                longitude = hit.longitude,
                regionLevel = hit.regionLevel,
                category = hit.category,
            )
        }

    companion object {
        private const val OVERVIEW_SUMMARY_LENGTH = 200
        private const val DEFAULT_RADIUS_KM = 5.0
    }

    override fun execute(query: SearchAttractionUseCase.Query): SearchAttractionUseCase.Result {
        val geo = toGeoFilter(query)
        val pageable = PageRequest.of(query.page.coerceAtLeast(0), query.size.coerceIn(1, 100))
        val keyword = query.keyword?.takeIf { it.isNotBlank() }
        // 벡터 레그에는 **원문**을 준다 — 문장의 뜻이 그 레그의 전부라 잘라내면 안 된다 (ADR-0090 개정).
        val embedding = resolveEmbedding(keyword, geo)
        // 키워드 레그에는 의도어를 뺀 잔여만 준다. 형태소가 쪼갠 조각이 내용어로 채점되는 것을 막는다.
        val understood = keyword?.let { QueryIntent.analyze(it, categoryLexicon.lexicon(query.lang)) }
        if (understood?.hasFilter == true) intentCounter.increment()
        val categories = query.category
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            .orEmpty()
        val page = attractionSearchPort.search(
            AttractionSearchPort.SearchQuery(
                // `?:` 를 쓰면 안 된다 — 잔여가 null 인 것은 「값이 없다」가 아니라
                // **「의도어만이라 검색어가 남지 않았다」**는 결과다. 엘비스로 원문을 되살리면
                // 방금 잘라낸 「해수욕장」이 그대로 BM25 에 돌아간다.
                keyword = if (understood != null) understood.residual else keyword,
                lang = query.lang?.takeIf { it.isNotBlank() },
                areaCode = query.areaCode?.takeIf { it.isNotBlank() },
                sidoCode = query.sidoCode?.takeIf { it.isNotBlank() },
                sigunguCode = query.sigunguCode?.takeIf { it.isNotBlank() },
                categories = categories,
                contentTypeId = understood?.contentTypeId,
                lclsCode = understood?.lclsCode,
                lclsDepth = understood?.lclsDepth,
                geo = geo,
                embedding = embedding,
            ),
            pageable,
        )
        return SearchAttractionUseCase.Result(
            searchId = UUID.randomUUID().toString(),
            attractions = page.content.mapIndexed { index, hit ->
                hit.document.toResult(distanceKm = hit.distanceKm, position = index, summarize = true)
            },
            totalElements = page.totalElements,
            totalPages = page.totalPages,
            currentPage = page.number,
        )
    }

    override fun findById(id: String): SearchAttractionUseCase.AttractionSearchResult? =
        attractionSearchPort.findById(id)?.toResult(distanceKm = null, position = 0, summarize = false)

    /**
     * 벡터 레그를 켤지 정한다. **끄는 쪽이 기본**이고, 넷 중 하나라도 아니면 BM25 로 간다:
     * 기능이 켜져 있고 · 스탬프가 설정돼 있고 · 키워드가 있고 · 거리순 정렬이 아니다.
     *
     * 거리순을 빼는 이유: 정렬이 점수를 무시하므로 벡터 레그를 얹어도 순서가 그대로다 —
     * 이웃 100개를 훑는 값만 치르고 얻는 것이 없다.
     */
    private fun resolveEmbedding(keyword: String?, geo: AttractionSearchPort.GeoFilter?): List<Float>? {
        // 검색어가 없는 목록 조회는 **폴백이 아니다** — 인코딩할 질의가 애초에 없다.
        // 이것을 bm25 로 세면 「벡터를 쓰려다 못 썼다」로 읽혀 폴백률이 부풀려진다.
        if (keyword == null) return null
        if (!hybrid.enabled || !queryVector.enabled || geo?.sortByDistance == true) {
            bm25Counter.increment()
            return null
        }
        val vector = resolveQueryVector.resolve(keyword, queryVector.modelRef)
        if (vector == null) bm25Counter.increment() else hybridCounter.increment()
        return vector
    }

    private fun toGeoFilter(query: SearchAttractionUseCase.Query): AttractionSearchPort.GeoFilter? {
        val lat = query.lat ?: return null
        val lng = query.lng ?: return null
        return AttractionSearchPort.GeoFilter(
            latitude = lat,
            longitude = lng,
            radiusKm = (query.radiusKm ?: DEFAULT_RADIUS_KM).coerceIn(0.1, 50.0),
            sortByDistance = query.sort == "distance",
        )
    }

    private fun AttractionDocument.toResult(
        distanceKm: Double?,
        position: Int,
        summarize: Boolean,
    ) = SearchAttractionUseCase.AttractionSearchResult(
        id = id,
        contentId = contentId,
        lang = lang,
        title = title,
        titleLocal = titleLocal,
        category = category,
        areaCode = areaCode,
        sidoCode = ldongRegnCd,
        address = address,
        latitude = latitude,
        longitude = longitude,
        imageUrl = imageUrl,
        thumbnailUrl = thumbnailUrl,
        tel = tel,
        overview = overview?.let { if (summarize && it.length > OVERVIEW_SUMMARY_LENGTH) it.take(OVERVIEW_SUMMARY_LENGTH) + "…" else it },
        useTime = useTime,
        restDate = restDate,
        useFee = useFee,
        parking = parking,
        parkingFee = parkingFee,
        infoCenter = infoCenter,
        introRaw = introRaw,
        googlePlaceId = googlePlaceId,
        distanceKm = distanceKm,
        position = position,
        modifiedAt = modifiedAt,
    )
}
