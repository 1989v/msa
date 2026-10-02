package com.kgd.search.application.attraction.usecase

/**
 * 관광지 상세 「주변 탐색」 — 이 관광지 둘레의 명소·숙소·행사·편의시설을 한 번에 (ADR-0105).
 * 키가 관광지 id 하나라 엣지가 캐시할 수 있다. 좌표·언어는 문서에서 가져온다.
 */
interface NearbyAttractionsUseCase {
    /** 문서가 없으면 null. */
    fun nearby(id: String): Nearby?

    data class Nearby(
        val sights: List<SearchAttractionUseCase.AttractionSearchResult>,
        val stays: List<SearchAttractionUseCase.AttractionSearchResult>,
        val events: List<SearchAttractionUseCase.AttractionSearchResult>,
        val amenities: List<SearchAttractionUseCase.AttractionSearchResult>,
    )
}
