package com.kgd.search.application.attraction.usecase

interface SearchAttractionUseCase {
    fun execute(query: Query): Result

    fun findById(id: String): AttractionSearchResult?

    data class Query(
        val keyword: String? = null,
        val lang: String? = null,
        val areaCode: String? = null,
        /** 법정동 축 (ADR-0071) — 지역 드릴다운이 쓰는 필터. */
        val sidoCode: String? = null,
        val sigunguCode: String? = null,
        /** 쉼표로 여러 개를 받는다 — `history` 도 `nature,history` 도 같은 파라미터다. */
        val category: String? = null,
        val lat: Double? = null,
        val lng: Double? = null,
        val radiusKm: Double? = null,
        /** relevance(기본) | distance — distance 는 lat/lng 지정 시에만 유효 */
        val sort: String = "relevance",
        val page: Int = 0,
        val size: Int = 20,
    )

    data class AttractionSearchResult(
        val id: String,
        val contentId: String,
        val lang: String,
        val title: String,
        val category: String? = null,
        val areaCode: String? = null,
        val address: String? = null,
        val latitude: Double,
        val longitude: Double,
        val imageUrl: String? = null,
        val tel: String? = null,
        /** 목록 응답은 200자 요약 — 전문은 단건 조회로 */
        val overview: String? = null,
        val distanceKm: Double? = null,
        val position: Int = 0,
    )

    data class Result(
        val searchId: String,
        val attractions: List<AttractionSearchResult>,
        val totalElements: Long,
        val totalPages: Int,
        val currentPage: Int,
    )
}
