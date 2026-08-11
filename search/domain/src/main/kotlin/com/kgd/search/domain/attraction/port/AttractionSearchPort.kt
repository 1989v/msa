package com.kgd.search.domain.attraction.port

import com.kgd.search.domain.attraction.model.AttractionDocument
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface AttractionSearchPort {

    fun search(query: SearchQuery, pageable: Pageable): Page<AttractionHit>

    fun findById(id: String): AttractionDocument?

    /**
     * 키워드가 null/blank 면 필터-only 탐색 (지도 영역 브라우징).
     * [geo] 지정 시 반경 필터가 걸리고, sortByDistance 면 거리 오름차순 정렬.
     */
    data class SearchQuery(
        val keyword: String? = null,
        val lang: String? = null,
        val areaCode: String? = null,
        val category: String? = null,
        val geo: GeoFilter? = null,
    )

    data class GeoFilter(
        val latitude: Double,
        val longitude: Double,
        val radiusKm: Double,
        val sortByDistance: Boolean = false,
    )

    /** [distanceKm] 는 geo 검색일 때만 채워진다. */
    data class AttractionHit(
        val document: AttractionDocument,
        val score: Double,
        val distanceKm: Double? = null,
    )
}
