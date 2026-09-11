package com.kgd.place.application.region.port

import com.kgd.place.domain.region.model.AdminRegion
import com.kgd.place.domain.region.model.AdminRegionLevel

interface AdminRegionRepositoryPort {
    /** 코드 자연키 기준 멱등 upsert — 이름·영문명만 갱신한다. */
    fun upsertAll(regions: List<AdminRegion>): UpsertSummary

    fun findByLevel(level: AdminRegionLevel): List<AdminRegion>

    fun findChildren(parentCode: String): List<AdminRegion>

    data class UpsertSummary(val created: Int, val updated: Int)
}
