package com.kgd.place.application.region.port

import com.kgd.place.domain.region.model.Region
import com.kgd.place.domain.region.model.RegionLevel

interface RegionRepositoryPort {
    fun save(region: Region): Region
    fun saveAll(regions: List<Region>): List<Region>
    fun findById(id: Long): Region?
    fun findByLevel(level: RegionLevel): List<Region>
    fun findByParentId(parentId: Long): List<Region>
    fun count(): Long
}
