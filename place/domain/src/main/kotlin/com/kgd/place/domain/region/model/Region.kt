package com.kgd.place.domain.region.model

import java.time.LocalDateTime

/**
 * 행정 지리 계층의 한 노드. CONTINENT → COUNTRY → REGION → CITY 를 self-FK([parentId])로 표현한다.
 * 좌표는 CITY/지점에만 존재할 수 있어 nullable. 출처: GeoNames(CC BY 4.0).
 */
class Region private constructor(
    val id: Long? = null,
    var parentId: Long? = null,
    var level: RegionLevel,
    var name: String,
    var nameKo: String? = null,
    var countryCode: String? = null,
    var admin1Code: String? = null,
    var admin2Code: String? = null,
    var geonamesId: Long? = null,
    var latitude: Double? = null,
    var longitude: Double? = null,
    var population: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    companion object {
        fun create(
            level: RegionLevel,
            name: String,
            parentId: Long? = null,
            nameKo: String? = null,
            countryCode: String? = null,
            admin1Code: String? = null,
            admin2Code: String? = null,
            geonamesId: Long? = null,
            latitude: Double? = null,
            longitude: Double? = null,
            population: Long? = null,
        ): Region {
            require(name.isNotBlank()) { "지역명은 비어있을 수 없습니다" }
            validateCoordinates(latitude, longitude)
            return Region(
                level = level,
                name = name,
                parentId = parentId,
                nameKo = nameKo?.takeIf { it.isNotBlank() },
                countryCode = countryCode?.takeIf { it.isNotBlank() }?.uppercase(),
                admin1Code = admin1Code?.takeIf { it.isNotBlank() },
                admin2Code = admin2Code?.takeIf { it.isNotBlank() },
                geonamesId = geonamesId,
                latitude = latitude,
                longitude = longitude,
                population = population,
            )
        }

        fun restore(
            id: Long?,
            parentId: Long?,
            level: RegionLevel,
            name: String,
            nameKo: String?,
            countryCode: String?,
            admin1Code: String?,
            admin2Code: String?,
            geonamesId: Long?,
            latitude: Double?,
            longitude: Double?,
            population: Long?,
            createdAt: LocalDateTime,
        ): Region = Region(
            id = id,
            parentId = parentId,
            level = level,
            name = name,
            nameKo = nameKo,
            countryCode = countryCode,
            admin1Code = admin1Code,
            admin2Code = admin2Code,
            geonamesId = geonamesId,
            latitude = latitude,
            longitude = longitude,
            population = population,
            createdAt = createdAt,
        )

        private fun validateCoordinates(latitude: Double?, longitude: Double?) {
            latitude?.let { require(it in -90.0..90.0) { "위도는 -90~90 범위여야 합니다: $it" } }
            longitude?.let { require(it in -180.0..180.0) { "경도는 -180~180 범위여야 합니다: $it" } }
        }
    }
}
