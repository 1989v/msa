package com.kgd.place.application.region.usecase

import com.kgd.place.domain.region.model.RegionLevel
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface GetRegionUseCase {
    fun findById(id: Long): RegionView
    fun findByLevel(level: RegionLevel): List<RegionView>
    fun findChildren(parentId: Long): List<RegionView>

    /** search-batch 재색인 풀스캔용. */
    fun findPage(pageable: Pageable): Page<RegionView>

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
