package com.kgd.place.application.region.usecase

import com.kgd.place.domain.region.model.RegionLevel

interface CreateRegionUseCase {
    fun execute(command: Command): Result

    /** 시드 적재용 — 한 트랜잭션에 N건 저장. */
    fun executeBulk(commands: List<Command>): List<Result>

    data class Command(
        val level: RegionLevel,
        val name: String,
        val parentId: Long? = null,
        val nameKo: String? = null,
        val countryCode: String? = null,
        val admin1Code: String? = null,
        val admin2Code: String? = null,
        val geonamesId: Long? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
        val population: Long? = null,
    )

    data class Result(
        val id: Long,
        val level: RegionLevel,
        val name: String,
        val nameKo: String? = null,
        val countryCode: String? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
    )
}
