package com.kgd.place.application.region.usecase

import com.kgd.place.domain.region.model.AdminRegionLevel

/**
 * 행정구역 조회·적재 (ADR-0071). `Region`(GeoNames 지명 계층)과 별개다 —
 * 세계 지명과 한국 행정구역을 한 축에 담으면 필터 결과가 경로에 따라 달라진다.
 */
interface AdminRegionUseCase {
    fun upsertAll(commands: List<Command>): Result

    /** `parentCode` 가 있으면 그 하위(시군구), 없으면 최상위(시도). */
    fun find(level: AdminRegionLevel, parentCode: String?): List<View>

    data class Command(
        val code: String,
        val level: AdminRegionLevel,
        val name: String,
        val parentCode: String? = null,
        val nameEn: String? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
    )

    data class View(
        val code: String,
        val parentCode: String?,
        val level: AdminRegionLevel,
        val name: String,
        val nameEn: String?,
        val latitude: Double?,
        val longitude: Double?,
    )

    data class Result(val created: Int, val updated: Int)
}
