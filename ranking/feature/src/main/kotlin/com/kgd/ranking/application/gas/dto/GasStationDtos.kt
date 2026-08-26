package com.kgd.ranking.application.gas.dto

import com.kgd.ranking.domain.model.GasPrice
import com.kgd.ranking.domain.model.GasStation
import java.time.Instant
import java.math.BigDecimal
import java.time.LocalDate

/** 유종별 판매가 한 줄 — 적재와 조회가 같은 모양을 쓴다. */
data class GasPriceItem(
    val productCode: String,
    val price: Int,
    val tradedAt: LocalDate? = null,
)

/**
 * 수집기가 보내는 주유소 한 건 (전체 동기화).
 *
 * **여기 있는 필드는 [GasStationResponse] 로 전부 되읽을 수 있어야 한다.**
 * `GasStationDtoRoundTripTest` 가 리플렉션으로 강제한다 — 세 곳(요청 DTO·엔티티·응답 DTO)을
 * 사람이 매번 맞추는 건 실패한다 (data-sources.md §0 ③).
 *
 * 좌표는 두 벌을 함께 받는다. [katecX]/[katecY] 는 원천이 준 KATEC(TM128) 그대로이고,
 * [latitude]/[longitude] 는 수집기가 변환한 WGS84 다.
 */
data class GasStationUpsertItem(
    val opinetId: String,
    val name: String,
    val brandCode: String? = null,
    val brandName: String? = null,
    val isSelf: Boolean = false,
    val katecX: BigDecimal? = null,
    val katecY: BigDecimal? = null,
    val latitude: BigDecimal? = null,
    val longitude: BigDecimal? = null,
    val areaCode: String? = null,
    val areaName: String? = null,
    val roadAddress: String? = null,
    val jibunAddress: String? = null,
    val tel: String? = null,
    val hasCarWash: Boolean? = null,
    val hasMaintenance: Boolean? = null,
    val hasCvs: Boolean? = null,
    val is24h: Boolean? = null,
    val prices: List<GasPriceItem> = emptyList(),
) {
    fun toDomain(syncedAt: Instant) = GasStation(
        id = null,
        opinetId = opinetId,
        name = name,
        brandCode = brandCode,
        brandName = brandName,
        isSelf = isSelf,
        katecX = katecX,
        katecY = katecY,
        latitude = latitude,
        longitude = longitude,
        areaCode = areaCode,
        areaName = areaName,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
        tel = tel,
        hasCarWash = hasCarWash,
        hasMaintenance = hasMaintenance,
        hasCvs = hasCvs,
        is24h = is24h,
        syncedAt = syncedAt,
        prices = prices.map { GasPrice(it.productCode, it.price, it.tradedAt) },
    )
}

data class GasStationBulkRequest(val stations: List<GasStationUpsertItem>)

data class GasStationBulkResult(val received: Int, val created: Int, val updated: Int)

/** 주유소 조회 응답 — 경로 탐색 결과 카드와 리더보드 상세가 함께 쓴다. */
data class GasStationResponse(
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
    val prices: List<GasPriceItem>,
) {
    companion object {
        fun of(station: GasStation) = GasStationResponse(
            opinetId = station.opinetId,
            name = station.name,
            brandCode = station.brandCode,
            brandName = station.brandName,
            isSelf = station.isSelf,
            katecX = station.katecX,
            katecY = station.katecY,
            latitude = station.latitude,
            longitude = station.longitude,
            areaCode = station.areaCode,
            areaName = station.areaName,
            roadAddress = station.roadAddress,
            jibunAddress = station.jibunAddress,
            tel = station.tel,
            hasCarWash = station.hasCarWash,
            hasMaintenance = station.hasMaintenance,
            hasCvs = station.hasCvs,
            is24h = station.is24h,
            prices = station.prices.map { GasPriceItem(it.productCode, it.price, it.tradedAt) },
        )
    }
}
