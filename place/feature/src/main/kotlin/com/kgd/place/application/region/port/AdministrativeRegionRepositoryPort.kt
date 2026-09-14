package com.kgd.place.application.region.port

import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel

interface AdministrativeRegionRepositoryPort {
    /** 코드 자연키 기준 멱등 upsert — 이름·영문명만 갱신한다. */
    fun upsertAll(regions: List<AdministrativeRegion>): UpsertSummary

    fun findByLevel(level: AdministrativeRegionLevel): List<AdministrativeRegion>

    fun findChildren(parentCode: String): List<AdministrativeRegion>

    data class UpsertSummary(val created: Int, val updated: Int)
}
