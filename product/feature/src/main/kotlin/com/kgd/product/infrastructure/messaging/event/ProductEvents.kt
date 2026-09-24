package com.kgd.product.infrastructure.messaging.event

import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

data class ProductCreatedEvent(
    val eventId: String = UUID.randomUUID().toString(),
    val productId: Long,
    val name: String,
    /** 원 단위 정수(KRW) — order 읽기 모델이 그대로 받는다 */
    val price: Long,
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
    val itemReportNo: String? = null,
    val eventTime: LocalDateTime = LocalDateTime.now(),
    /** 읽기 모델이 늦게 도착한 옛 이벤트를 거르는 기준 — eventTime 은 존이 없어 search 호환용으로만 남긴다 */
    val occurredAt: Instant = Instant.now(),
)

data class ProductUpdatedEvent(
    val eventId: String = UUID.randomUUID().toString(),
    val productId: Long,
    val name: String,
    /** 원 단위 정수(KRW) */
    val price: Long,
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
    val itemReportNo: String? = null,
    val eventTime: LocalDateTime = LocalDateTime.now(),
    val occurredAt: Instant = Instant.now(),
)
