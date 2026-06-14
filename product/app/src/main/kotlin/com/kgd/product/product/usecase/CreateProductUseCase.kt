package com.kgd.product.application.product.usecase

import java.math.BigDecimal

interface CreateProductUseCase {
    fun execute(command: Command): Result

    /** 대량 적재 — 한 트랜잭션에 N건 저장 후 건별 Kafka 이벤트 발행 (ETL 시드 경로) */
    fun executeBulk(commands: List<Command>): List<Result>

    data class Command(
        val name: String,
        val price: BigDecimal,
        val stock: Int,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null
    )

    data class Result(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val stock: Int,
        val status: String,
        val brand: String? = null,
        val description: String? = null,
        val category: String? = null
    )
}
