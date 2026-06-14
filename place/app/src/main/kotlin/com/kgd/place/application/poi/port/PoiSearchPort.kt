package com.kgd.place.application.poi.port

import com.kgd.place.domain.poi.model.PoiDocument

interface PoiSearchPort {
    /** 중심 좌표 반경 내 POI 를 거리 오름차순으로 반환. */
    fun nearby(query: NearbyQuery): List<PoiDocument>

    data class NearbyQuery(
        val latitude: Double,
        val longitude: Double,
        val radiusKm: Double,
        val category: String? = null,
        val keyword: String? = null,
        val size: Int = 20,
    )
}
