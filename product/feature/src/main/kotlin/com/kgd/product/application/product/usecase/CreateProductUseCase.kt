package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface CreateProductUseCase {
    fun execute(command: Command, requester: ProductRequester): Result

    /**
     * 대량 적재 — 한 트랜잭션에 N건 저장 + 건별 이벤트를 아웃박스에 (ETL 시드 경로).
     * 요청자가 없다 — 클러스터 안 배치만 닿는 `/internal` 경로 전용이다.
     */
    fun executeBulk(commands: List<Command>): List<Result>

    data class Command(
        val name: String,
        val price: BigDecimal,
        val stock: Int,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null,
        val energyKcal: Double? = null,
        val carbohydrateG: Double? = null,
        val proteinG: Double? = null,
        val fatG: Double? = null,
        val sugarG: Double? = null,
        val sodiumMg: Double? = null,
        val ingredients: String? = null,
        val originCountry: String? = null,
        val itemReportNo: String? = null
    )

    data class Result(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val stock: Int,
        val status: String,
        val sellerId: Long,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null,
        val energyKcal: Double? = null,
        val carbohydrateG: Double? = null,
        val proteinG: Double? = null,
        val fatG: Double? = null,
        val sugarG: Double? = null,
        val sodiumMg: Double? = null,
        val ingredients: String? = null,
        val originCountry: String? = null,
        val itemReportNo: String? = null
    )
}
