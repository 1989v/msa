package com.kgd.quant.presentation.dto

/**
 * DashboardOverview — `GET /api/v1/dashboard/overview` 응답.
 *
 * FE (HomePage) 가 기대하는 schema 와 일치. BigDecimal/Instant 는 직렬화 호환성을 위해
 * String 으로 노출 (FE 가 toLocaleString 등 string 처리).
 */
data class DashboardOverview(
    val tenantId: String,
    val totalStrategies: Int,
    val totalBacktests: Int,
    val cumulativeRealizedPnl: String,
    val totalFills: Long,
    val lastRunEndedAt: String? = null,
)
