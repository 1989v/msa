package com.kgd.place.domain.poi.model

/**
 * POI 검색 read model (OpenSearch `poi` 인덱스). location 은 geo_point 로 색인된다.
 */
data class PoiDocument(
    val id: String,
    val name: String,
    val categoryMajor: String?,
    val categoryMid: String?,
    val address: String?,
    val latitude: Double,
    val longitude: Double,
    val status: String,
)
