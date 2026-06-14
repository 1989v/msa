package com.kgd.place.presentation.region.dto

import com.kgd.place.application.region.usecase.CreateRegionUseCase
import com.kgd.place.application.region.usecase.GetRegionUseCase
import com.kgd.place.domain.region.model.RegionLevel

data class RegionResponse(
    val id: Long,
    val parentId: Long?,
    val level: RegionLevel,
    val name: String,
    val nameKo: String?,
    val countryCode: String?,
    val admin1Code: String?,
    val admin2Code: String?,
    val latitude: Double?,
    val longitude: Double?,
    val population: Long?,
) {
    companion object {
        fun from(view: GetRegionUseCase.RegionView) = RegionResponse(
            id = view.id,
            parentId = view.parentId,
            level = view.level,
            name = view.name,
            nameKo = view.nameKo,
            countryCode = view.countryCode,
            admin1Code = view.admin1Code,
            admin2Code = view.admin2Code,
            latitude = view.latitude,
            longitude = view.longitude,
            population = view.population,
        )

        fun from(result: CreateRegionUseCase.Result) = RegionResponse(
            id = result.id,
            parentId = null,
            level = result.level,
            name = result.name,
            nameKo = result.nameKo,
            countryCode = result.countryCode,
            admin1Code = null,
            admin2Code = null,
            latitude = result.latitude,
            longitude = result.longitude,
            population = null,
        )
    }
}

data class BulkCreateRegionResponse(
    val count: Int,
    val ids: List<Long>,
) {
    companion object {
        fun from(results: List<CreateRegionUseCase.Result>) =
            BulkCreateRegionResponse(count = results.size, ids = results.map { it.id })
    }
}
