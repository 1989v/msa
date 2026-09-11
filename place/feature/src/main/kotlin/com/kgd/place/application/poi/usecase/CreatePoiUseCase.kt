package com.kgd.place.application.poi.usecase

interface CreatePoiUseCase {
    fun execute(command: Command): Result

    /** 시드/대량 적재 — 저장 후 OpenSearch 일괄 색인. */
    fun executeBulk(commands: List<Command>): List<Result>

    data class Command(
        val source: String,
        val sourceKey: String,
        val name: String,
        val latitude: Double,
        val longitude: Double,
        val categoryMajor: String? = null,
        val categoryMid: String? = null,
        val categorySub: String? = null,
        val regionId: Long? = null,
        val roadAddress: String? = null,
        val jibunAddress: String? = null,
    )

    data class Result(
        val id: Long,
        val name: String,
        val categoryMajor: String? = null,
        val latitude: Double,
        val longitude: Double,
    )
}
