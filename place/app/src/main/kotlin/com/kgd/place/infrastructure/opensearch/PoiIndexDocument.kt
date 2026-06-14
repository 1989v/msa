package com.kgd.place.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.kgd.place.domain.poi.model.PoiDocument

/** OpenSearch geo_point 는 {"lat":..,"lon":..} 객체로 색인된다. */
data class GeoPoint(val lat: Double, val lon: Double)

/**
 * `poi` 인덱스 색인/조회 문서. 필드 타입/분석기 정의는 `opensearch/poi-index.json` 이 SSOT.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class PoiIndexDocument(
    val id: String,
    val name: String,
    val categoryMajor: String? = null,
    val categoryMid: String? = null,
    val address: String? = null,
    val location: GeoPoint,
    val status: String,
) {
    fun toDomain(): PoiDocument = PoiDocument(
        id = id,
        name = name,
        categoryMajor = categoryMajor,
        categoryMid = categoryMid,
        address = address,
        latitude = location.lat,
        longitude = location.lon,
        status = status,
    )

    companion object {
        fun fromDomain(doc: PoiDocument) = PoiIndexDocument(
            id = doc.id,
            name = doc.name,
            categoryMajor = doc.categoryMajor,
            categoryMid = doc.categoryMid,
            address = doc.address,
            location = GeoPoint(doc.latitude, doc.longitude),
            status = doc.status,
        )
    }
}
