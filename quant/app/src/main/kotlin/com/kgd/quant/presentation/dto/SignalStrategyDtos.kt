package com.kgd.quant.presentation.dto

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.kgd.quant.domain.asset.AssetClass
import java.math.BigDecimal

/**
 * Strategy 등록 / 응답 DTO (ADR-0033 Phase 1).
 *
 * SignalConfig / PositionSizing 은 Jackson polymorphic — type discriminator 사용.
 */
data class CreateSignalStrategyRequest(
    val assetCode: String,
    val assetClass: AssetClass,
    val assetDisplayName: String,
    val marketCode: String,
    val entrySignal: SignalConfigDto,
    val exitSignal: SignalConfigDto?,
    val sizing: PositionSizingDto,
)

data class SignalStrategyResponse(
    val id: String,
    val assetCode: String,
    val assetClass: AssetClass,
    val marketCode: String,
    val entrySignal: SignalConfigDto,
    val exitSignal: SignalConfigDto?,
    val sizing: PositionSizingDto,
    val createdAt: String,
    val description: String,
)

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = SignalConfigDto.VolumeSpikeDto::class, name = "VOLUME_SPIKE"),
    JsonSubTypes.Type(value = SignalConfigDto.RsiBreakoutDto::class, name = "RSI_BREAKOUT"),
    JsonSubTypes.Type(value = SignalConfigDto.MaCrossDto::class, name = "MA_CROSS"),
    JsonSubTypes.Type(value = SignalConfigDto.BollingerSqueezeDto::class, name = "BB_SQUEEZE"),
    JsonSubTypes.Type(value = SignalConfigDto.KimchiPremiumThresholdDto::class, name = "KIMCHI_PREMIUM"),
)
sealed class SignalConfigDto {
    data class VolumeSpikeDto(val multiplier: BigDecimal, val window: Int) : SignalConfigDto()
    data class RsiBreakoutDto(val period: Int, val threshold: BigDecimal, val direction: String) : SignalConfigDto()
    data class MaCrossDto(val fastPeriod: Int, val slowPeriod: Int, val direction: String) : SignalConfigDto()
    data class BollingerSqueezeDto(val period: Int, val stdDev: BigDecimal, val squeezeThreshold: BigDecimal) : SignalConfigDto()
    data class KimchiPremiumThresholdDto(val entryThresholdPercent: BigDecimal, val exitThresholdPercent: BigDecimal) : SignalConfigDto()
}

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = PositionSizingDto.FixedKrwDto::class, name = "FIXED_KRW"),
    JsonSubTypes.Type(value = PositionSizingDto.PercentBalanceDto::class, name = "PERCENT_BALANCE"),
    JsonSubTypes.Type(value = PositionSizingDto.FixedQuantityDto::class, name = "FIXED_QUANTITY"),
)
sealed class PositionSizingDto {
    data class FixedKrwDto(val amountKrw: BigDecimal) : PositionSizingDto()
    data class PercentBalanceDto(val percent: BigDecimal) : PositionSizingDto()
    data class FixedQuantityDto(val quantity: BigDecimal) : PositionSizingDto()
}
