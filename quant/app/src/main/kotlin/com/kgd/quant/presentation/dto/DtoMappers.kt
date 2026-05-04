package com.kgd.quant.presentation.dto

import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.strategy.BollingerSqueeze
import com.kgd.quant.domain.strategy.FixedKrw
import com.kgd.quant.domain.strategy.FixedQuantity
import com.kgd.quant.domain.strategy.MaCross
import com.kgd.quant.domain.strategy.PercentBalance
import com.kgd.quant.domain.strategy.PositionSizing
import com.kgd.quant.domain.strategy.RsiBreakout
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.SignalStrategy
import com.kgd.quant.domain.strategy.VolumeSpike

internal fun SignalConfigDto.toDomain(): SignalConfig = when (this) {
    is SignalConfigDto.VolumeSpikeDto -> VolumeSpike(multiplier, window)
    is SignalConfigDto.RsiBreakoutDto -> RsiBreakout(
        period = period,
        threshold = threshold,
        direction = RsiBreakout.Direction.valueOf(direction),
    )
    is SignalConfigDto.MaCrossDto -> MaCross(
        fastPeriod = fastPeriod,
        slowPeriod = slowPeriod,
        direction = MaCross.CrossDirection.valueOf(direction),
    )
    is SignalConfigDto.BollingerSqueezeDto -> BollingerSqueeze(period, stdDev, squeezeThreshold)
    is SignalConfigDto.KimchiPremiumThresholdDto ->
        com.kgd.quant.domain.strategy.KimchiPremiumThreshold(entryThresholdPercent, exitThresholdPercent)
}

internal fun SignalConfig.toDto(): SignalConfigDto = when (this) {
    is VolumeSpike -> SignalConfigDto.VolumeSpikeDto(multiplier, window)
    is RsiBreakout -> SignalConfigDto.RsiBreakoutDto(period, threshold, direction.name)
    is MaCross -> SignalConfigDto.MaCrossDto(fastPeriod, slowPeriod, direction.name)
    is BollingerSqueeze -> SignalConfigDto.BollingerSqueezeDto(period, stdDev, squeezeThreshold)
    is com.kgd.quant.domain.strategy.KimchiPremiumThreshold ->
        // Phase 2 신규 — DTO 는 P2-T10 후속에서 추가, 임시 BollingerSqueezeDto 미사용 방지를 위해 별도 DTO 정의 필요
        SignalConfigDto.KimchiPremiumThresholdDto(entryThresholdPercent, exitThresholdPercent)
}

internal fun PositionSizingDto.toDomain(): PositionSizing = when (this) {
    is PositionSizingDto.FixedKrwDto -> FixedKrw(amountKrw)
    is PositionSizingDto.PercentBalanceDto -> PercentBalance(percent)
    is PositionSizingDto.FixedQuantityDto -> FixedQuantity(quantity)
}

internal fun PositionSizing.toDto(): PositionSizingDto = when (this) {
    is FixedKrw -> PositionSizingDto.FixedKrwDto(amountKrw)
    is PercentBalance -> PositionSizingDto.PercentBalanceDto(percent)
    is FixedQuantity -> PositionSizingDto.FixedQuantityDto(quantity)
}

internal fun CreateSignalStrategyRequest.asset(): Asset = Asset(
    code = AssetCode(assetCode),
    assetClass = assetClass,
    displayName = assetDisplayName,
)

internal fun CreateSignalStrategyRequest.market(): Market = Market(
    code = MarketCode(marketCode),
    supportedClasses = setOf(assetClass),
    displayName = marketCode,
)

internal fun SignalStrategy.toResponse(): SignalStrategyResponse = SignalStrategyResponse(
    id = id.value.toString(),
    assetCode = asset.code.value,
    assetClass = asset.assetClass,
    marketCode = market.code.value,
    entrySignal = entrySignal.toDto(),
    exitSignal = exitSignal?.toDto(),
    sizing = sizing.toDto(),
    createdAt = createdAt.toString(),
    description = describe(),
)
