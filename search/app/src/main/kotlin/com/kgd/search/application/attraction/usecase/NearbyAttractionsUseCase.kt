package com.kgd.search.application.attraction.usecase

import java.time.LocalDate

/**
 * 관광지 상세 「주변 탐색」 — 이 관광지 둘레의 명소·숙소·행사·편의시설을 한 번에 (ADR-0105).
 * 키가 관광지 id 하나라 엣지가 캐시할 수 있다. 좌표·언어는 문서에서 가져온다.
 */
interface NearbyAttractionsUseCase {
    /** 문서가 없으면 null. */
    fun nearby(id: String): Nearby?

    data class Nearby(
        val sights: List<NearbyPlace>,
        val stays: List<NearbyPlace>,
        val events: List<NearbyPlace>,
        val amenities: List<NearbyPlace>,
    )

    /**
     * 주변 목록 한 줄 — 지도 핀과 목록 줄을 그리는 필드만. 검색 결과를 통째로 내면 사진 목록·소개 원문·링크가
     * 93건에 실려 응답 하나가 534KB 였다(2026-10-03 해운대 실측).
     */
    data class NearbyPlace(
        val id: String,
        val lang: String,
        val title: String,
        val titleLocal: String?,
        val category: String?,
        val contentTypeId: String?,
        val latitude: Double,
        val longitude: Double,
        val distanceKm: Double?,
        val imageUrl: String?,
        val eventStart: LocalDate?,
        val eventEnd: LocalDate?,
    ) {
        companion object {
            fun of(r: SearchAttractionUseCase.AttractionSearchResult) = NearbyPlace(
                id = r.id,
                lang = r.lang,
                title = r.title,
                titleLocal = r.titleLocal,
                category = r.category,
                contentTypeId = r.contentTypeId,
                latitude = r.latitude,
                longitude = r.longitude,
                distanceKm = r.distanceKm,
                imageUrl = r.imageUrl,
                eventStart = r.eventStart,
                eventEnd = r.eventEnd,
            )
        }
    }
}
