package com.kgd.search.domain.product.model

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductDocument(
    val id: String,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val popularityScore: Double = 0.0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0,
    val ctrRaw: Double = 0.0,
    val cvrRaw: Double = 0.0,
    val gmv7d: Double = 0.0,
    val gmv30d: Double = 0.0,
    val scoreUpdatedAt: Long = 0,
    val categoryId: String? = null,
    val brand: String? = null,
    val description: String? = null,
    val category: String? = null,
    // 영양성분 100g 기준 (ADR-0059) — 오픈데이터 미매칭 시 null
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
