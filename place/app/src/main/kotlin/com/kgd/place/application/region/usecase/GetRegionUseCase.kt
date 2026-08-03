package com.kgd.place.application.region.usecase

import com.kgd.place.domain.region.model.RegionLevel

interface GetRegionUseCase {
    fun findById(id: Long): RegionView
    fun findByLevel(level: RegionLevel): List<RegionView>
    fun findChildren(parentId: Long): List<RegionView>

    data class RegionView(
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
    )
}
