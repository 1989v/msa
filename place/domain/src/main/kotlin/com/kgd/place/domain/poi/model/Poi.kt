package com.kgd.place.domain.poi.model

import java.time.LocalDateTime

/**
 * Point of Interest — 음식점/카페/상점 등. MySQL SSOT, OpenSearch(poi 인덱스)는 read model.
 * 출처: 소상공인시장진흥공단 상가정보(SANGGA, data.go.kr 제한없음) / Foursquare OS Places(FOURSQUARE).
 */
class Poi private constructor(
    val id: Long? = null,
    var source: String,
    var sourceKey: String,
    var name: String,
    var categoryMajor: String? = null,
    var categoryMid: String? = null,
    var categorySub: String? = null,
    var regionId: Long? = null,
    var roadAddress: String? = null,
    var jibunAddress: String? = null,
    var latitude: Double,
    var longitude: Double,
    var status: String = "ACTIVE",
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    companion object {
        fun create(
            source: String,
            sourceKey: String,
            name: String,
            latitude: Double,
            longitude: Double,
            categoryMajor: String? = null,
            categoryMid: String? = null,
            categorySub: String? = null,
            regionId: Long? = null,
            roadAddress: String? = null,
            jibunAddress: String? = null,
        ): Poi {
            require(source.isNotBlank()) { "source 는 비어있을 수 없습니다" }
            require(sourceKey.isNotBlank()) { "sourceKey 는 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "POI 명은 비어있을 수 없습니다" }
            require(latitude in -90.0..90.0) { "위도는 -90~90 범위여야 합니다: $latitude" }
            require(longitude in -180.0..180.0) { "경도는 -180~180 범위여야 합니다: $longitude" }
            return Poi(
                source = source,
                sourceKey = sourceKey,
                name = name,
                latitude = latitude,
                longitude = longitude,
                categoryMajor = categoryMajor?.takeIf { it.isNotBlank() },
                categoryMid = categoryMid?.takeIf { it.isNotBlank() },
                categorySub = categorySub?.takeIf { it.isNotBlank() },
                regionId = regionId,
                roadAddress = roadAddress?.takeIf { it.isNotBlank() },
                jibunAddress = jibunAddress?.takeIf { it.isNotBlank() },
                status = "ACTIVE",
            )
        }

        @Suppress("LongParameterList")
        fun restore(
            id: Long?,
            source: String,
            sourceKey: String,
            name: String,
            categoryMajor: String?,
            categoryMid: String?,
            categorySub: String?,
            regionId: Long?,
            roadAddress: String?,
            jibunAddress: String?,
            latitude: Double,
            longitude: Double,
            status: String,
            createdAt: LocalDateTime,
        ): Poi = Poi(
            id = id,
            source = source,
            sourceKey = sourceKey,
            name = name,
            categoryMajor = categoryMajor,
            categoryMid = categoryMid,
            categorySub = categorySub,
            regionId = regionId,
            roadAddress = roadAddress,
            jibunAddress = jibunAddress,
            latitude = latitude,
            longitude = longitude,
            status = status,
            createdAt = createdAt,
        )
    }

    /** 검색 read model 로 변환. 표시 주소는 도로명 우선, 없으면 지번. */
    fun toDocument(): PoiDocument = PoiDocument(
        id = requireNotNull(id) { "POI ID 가 null 입니다" }.toString(),
        name = name,
        categoryMajor = categoryMajor,
        categoryMid = categoryMid,
        address = roadAddress ?: jibunAddress,
        latitude = latitude,
        longitude = longitude,
        status = status,
    )
}
