package com.kgd.place.application.attraction.usecase

import java.time.LocalDateTime

interface UpsertAttractionUseCase {
    fun executeBulk(commands: List<Command>): Result

    data class Command(
        val contentId: String,
        val lang: String,
        val title: String,
        val latitude: Double,
        val longitude: Double,
        val address: String? = null,
        val areaCode: String? = null,
        val sigunguCode: String? = null,
        val ldongRegnCd: String? = null,
        val ldongSignguCd: String? = null,
        val category: String? = null,
        val cat1: String? = null,
        val cat2: String? = null,
        val cat3: String? = null,
        val imageUrl: String? = null,
        val tel: String? = null,
        val overview: String? = null,
        val sourceModifiedAt: LocalDateTime? = null,
    )

    data class Result(val created: Int, val updated: Int, val total: Long)
}
