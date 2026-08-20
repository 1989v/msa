package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort
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
) : SearchAttractionUseCase, SuggestAttractionUseCase {

    override fun execute(prefix: String, lang: String?, size: Int): List<SuggestAttractionUseCase.Suggestion> =
        attractionSearchPort.suggest(prefix, lang?.takeIf { it.isNotBlank() }, size).map { hit ->
            SuggestAttractionUseCase.Suggestion(
                type = hit.type.name,
                id = hit.id,
                title = hit.title,
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
        val page = attractionSearchPort.search(
            AttractionSearchPort.SearchQuery(
                keyword = query.keyword?.takeIf { it.isNotBlank() },
                lang = query.lang?.takeIf { it.isNotBlank() },
                areaCode = query.areaCode?.takeIf { it.isNotBlank() },
                sidoCode = query.sidoCode?.takeIf { it.isNotBlank() },
                sigunguCode = query.sigunguCode?.takeIf { it.isNotBlank() },
                category = query.category?.takeIf { it.isNotBlank() },
                geo = geo,
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
        category = category,
        areaCode = areaCode,
        address = address,
        latitude = latitude,
        longitude = longitude,
        imageUrl = imageUrl,
        tel = tel,
        overview = overview?.let { if (summarize && it.length > OVERVIEW_SUMMARY_LENGTH) it.take(OVERVIEW_SUMMARY_LENGTH) + "…" else it },
        distanceKm = distanceKm,
        position = position,
    )
}
