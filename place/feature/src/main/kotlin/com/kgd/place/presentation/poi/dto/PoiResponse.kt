package com.kgd.place.presentation.poi.dto

import com.kgd.place.application.poi.usecase.CreatePoiUseCase
import com.kgd.place.application.poi.usecase.NearbyPoiUseCase

data class PoiResponse(
    val id: Long,
    val name: String,
    val categoryMajor: String?,
    val latitude: Double,
    val longitude: Double,
) {
    companion object {
        fun from(result: CreatePoiUseCase.Result) = PoiResponse(
            id = result.id,
            name = result.name,
            categoryMajor = result.categoryMajor,
            latitude = result.latitude,
            longitude = result.longitude,
        )
    }
}

data class BulkCreatePoiResponse(
    val count: Int,
    val ids: List<Long>,
) {
    companion object {
        fun from(results: List<CreatePoiUseCase.Result>) =
            BulkCreatePoiResponse(count = results.size, ids = results.map { it.id })
    }
}

data class NearbyPoiResponse(
    val id: String,
    val name: String,
    val categoryMajor: String?,
    val categoryMid: String?,
    val address: String?,
    val latitude: Double,
    val longitude: Double,
    val distanceKm: Double,
) {
    companion object {
        fun from(result: NearbyPoiUseCase.Result) = NearbyPoiResponse(
            id = result.id,
            name = result.name,
            categoryMajor = result.categoryMajor,
            categoryMid = result.categoryMid,
            address = result.address,
            latitude = result.latitude,
            longitude = result.longitude,
            distanceKm = Math.round(result.distanceKm * 1000) / 1000.0,
        )
    }
}
