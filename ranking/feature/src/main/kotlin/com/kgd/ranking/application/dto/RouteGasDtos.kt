package com.kgd.ranking.application.dto

import java.math.BigDecimal

data class PointRequest(val latitude: Double, val longitude: Double)

/**
 * 경로 위 주유소 찾기 요청 (ADR-0081 §7).
 *
 * [detourLimitMin] 이 검색 반경을 정한다 — "5분까지 돌아갈 수 있다"는 곧 경로에서 얼마나
 * 떨어진 곳까지 후보로 볼지와 같은 말이다. 반경을 따로 받지 않는 이유다.
 */
data class RouteGasSearchRequest(
    val origin: PointRequest,
    val destination: PointRequest,
    val productCode: String = "B027",
    val detourLimitMin: Int = 5,
    val selfOnly: Boolean = false,
    val brands: List<String> = emptyList(),
    val limit: Int = 20,
)

data class RouteGasCandidate(
    val opinetId: String,
    val name: String,
    val brandCode: String?,
    val brandName: String?,
    val isSelf: Boolean,
    val latitude: BigDecimal?,
    val longitude: BigDecimal?,
    val roadAddress: String?,
    val price: Int,
    /** **근사값이다.** 경로에서 떨어진 거리를 왕복으로 보고 경로 평균 속도로 나눈 값 */
    val detourMinutes: Int,
    val distanceToRouteMeters: Int,
    /** 경로 위 후보들의 평균가 대비 절약액(원/L). 음수면 평균보다 비싸다 */
    val savingsPerLiter: Int,
)

data class RouteGasSearchResponse(
    val encodedPolyline: String,
    val distanceMeters: Int,
    val durationMinutes: Int,
    val productCode: String,
    val averagePrice: Int?,
    val sourceLabel: String,
    val candidates: List<RouteGasCandidate>,
)
