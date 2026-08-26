package com.kgd.ranking.domain.model

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

/** 유종별 판매가 한 줄. */
data class GasPrice(
    val productCode: String,
    val price: Int,
    val tradedAt: LocalDate?,
)

/**
 * 주유소 — 오피넷 수집분 (ADR-0081).
 *
 * 좌표가 두 벌이다. [katecX]/[katecY] 는 원천이 준 KATEC(TM128) 그대로, [latitude]/[longitude] 는
 * 수집기가 변환한 WGS84 — 변환 규칙이 틀렸을 때 되돌릴 근거가 남아 있어야 한다 (data-sources.md §0).
 *
 * 저장은 **전체 동기화**다. 넘어오지 않은 값은 지워지고, [prices] 에 없는 유종의 가격 행도 지워진다 —
 * 경유 취급을 그만둔 주유소에 어제 가격이 남으면 안 되기 때문이다.
 */
data class GasStation(
    val id: Long?,
    val opinetId: String,
    val name: String,
    val brandCode: String?,
    val brandName: String?,
    val isSelf: Boolean,
    val katecX: BigDecimal?,
    val katecY: BigDecimal?,
    val latitude: BigDecimal?,
    val longitude: BigDecimal?,
    val areaCode: String?,
    val areaName: String?,
    val roadAddress: String?,
    val jibunAddress: String?,
    val tel: String?,
    val hasCarWash: Boolean?,
    val hasMaintenance: Boolean?,
    val hasCvs: Boolean?,
    val is24h: Boolean?,
    val syncedAt: Instant,
    val prices: List<GasPrice> = emptyList(),
) {
    fun priceOf(productCode: String): GasPrice? = prices.firstOrNull { it.productCode == productCode }
}
