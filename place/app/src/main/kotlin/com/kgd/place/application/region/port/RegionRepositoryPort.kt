package com.kgd.place.application.region.port

import com.kgd.place.domain.region.model.Region
import com.kgd.place.domain.region.model.RegionLevel
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface RegionRepositoryPort {
    fun save(region: Region): Region
    fun saveAll(regions: List<Region>): List<Region>
    fun findById(id: Long): Region?
    fun findByLevel(level: RegionLevel): List<Region>
    fun findByParentId(parentId: Long): List<Region>
    fun findByGeonamesIdIn(geonamesIds: Collection<Long>): List<Region>
    /** search-batch 재색인 풀스캔용. */
    fun findPage(pageable: Pageable): Page<Region>
    fun count(): Long
}
