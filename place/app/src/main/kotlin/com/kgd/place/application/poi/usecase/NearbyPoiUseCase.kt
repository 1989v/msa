package com.kgd.place.application.poi.usecase

interface NearbyPoiUseCase {
    fun nearby(query: Query): List<Result>

    data class Query(
        val latitude: Double,
        val longitude: Double,
        val radiusKm: Double,
        val category: String? = null,
        val keyword: String? = null,
        val size: Int = 20,
    )

    data class Result(
        val id: String,
        val name: String,
        val categoryMajor: String?,
        val categoryMid: String?,
        val address: String?,
        val latitude: Double,
        val longitude: Double,
        val distanceKm: Double,
    )
}
