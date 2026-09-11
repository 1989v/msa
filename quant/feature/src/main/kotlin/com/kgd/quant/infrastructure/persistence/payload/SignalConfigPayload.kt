package com.kgd.quant.infrastructure.persistence.payload

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.strategy.PositionSizing
import com.kgd.quant.domain.strategy.SignalConfig
import java.math.BigDecimal

/**
 * `signal_strategy.entry_signal_json` / `exit_signal_json` / `sizing_json` 의 **저장 포맷**.
 *
 * 전에는 프레젠테이션 DTO(`SignalConfigDto`)를 그대로 직렬화해 넣었다. 그러면 판별자
 * (`VOLUME_SPIKE` 등)가 **API 계약이자 이미 저장된 값**이 되어, FE 와 맞추려고 응답 DTO 의 이름
 * 하나를 바꾸는 순간 기존 행이 역직렬화에서 터진다. 커밋한 마이그레이션은 되돌릴 수 없고
 * main 이 곧 배포 브랜치라, 배포된 뒤에야 드러난다.
 *
 * 그래서 저장 포맷을 infrastructure 가 따로 소유한다. 도메인이 가운데 서고 두 계약이 따로 움직인다.
 * **아래 판별자 문자열은 이미 DB 에 들어 있는 값이다 — 바꾸면 기존 행을 못 읽는다.**
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = SignalConfigPayload.VolumeSpike::class, name = "VOLUME_SPIKE"),
    JsonSubTypes.Type(value = SignalConfigPayload.RsiBreakout::class, name = "RSI_BREAKOUT"),
    JsonSubTypes.Type(value = SignalConfigPayload.MaCross::class, name = "MA_CROSS"),
    JsonSubTypes.Type(value = SignalConfigPayload.BollingerSqueeze::class, name = "BB_SQUEEZE"),
    JsonSubTypes.Type(value = SignalConfigPayload.KimchiPremiumThreshold::class, name = "KIMCHI_PREMIUM"),
)
sealed class SignalConfigPayload {
    data class VolumeSpike(val multiplier: BigDecimal, val window: Int) : SignalConfigPayload()
    data class RsiBreakout(val period: Int, val threshold: BigDecimal, val direction: String) : SignalConfigPayload()
    data class MaCross(val fastPeriod: Int, val slowPeriod: Int, val direction: String) : SignalConfigPayload()
    data class BollingerSqueeze(val period: Int, val stdDev: BigDecimal, val squeezeThreshold: BigDecimal) : SignalConfigPayload()
    data class KimchiPremiumThreshold(
        val entryThresholdPercent: BigDecimal,
        val exitThresholdPercent: BigDecimal,
        val foreignMarket: String,
    ) : SignalConfigPayload()

    fun toDomain(): SignalConfig = when (this) {
        is VolumeSpike -> com.kgd.quant.domain.strategy.VolumeSpike(multiplier, window)
        is RsiBreakout -> com.kgd.quant.domain.strategy.RsiBreakout(
            period = period,
            threshold = threshold,
            direction = com.kgd.quant.domain.strategy.RsiBreakout.Direction.valueOf(direction),
        )
        is MaCross -> com.kgd.quant.domain.strategy.MaCross(
            fastPeriod = fastPeriod,
            slowPeriod = slowPeriod,
            direction = com.kgd.quant.domain.strategy.MaCross.CrossDirection.valueOf(direction),
        )
        is BollingerSqueeze -> com.kgd.quant.domain.strategy.BollingerSqueeze(period, stdDev, squeezeThreshold)
        is KimchiPremiumThreshold -> com.kgd.quant.domain.strategy.KimchiPremiumThreshold(
            entryThresholdPercent = entryThresholdPercent,
            exitThresholdPercent = exitThresholdPercent,
            foreignMarket = MarketCode(foreignMarket),
        )
    }

    companion object {
        // `is VolumeSpike` 처럼 쓰면 도메인이 아니라 이 파일의 중첩 타입으로 붙는다 — 도메인 쪽을 FQN 으로
        fun from(config: SignalConfig): SignalConfigPayload = when (config) {
            is com.kgd.quant.domain.strategy.VolumeSpike -> VolumeSpike(config.multiplier, config.window)
            is com.kgd.quant.domain.strategy.RsiBreakout -> RsiBreakout(config.period, config.threshold, config.direction.name)
            is com.kgd.quant.domain.strategy.MaCross -> MaCross(config.fastPeriod, config.slowPeriod, config.direction.name)
            is com.kgd.quant.domain.strategy.BollingerSqueeze ->
                BollingerSqueeze(config.period, config.stdDev, config.squeezeThreshold)
            is com.kgd.quant.domain.strategy.KimchiPremiumThreshold -> KimchiPremiumThreshold(
                entryThresholdPercent = config.entryThresholdPercent,
                exitThresholdPercent = config.exitThresholdPercent,
                foreignMarket = config.foreignMarket.value,
            )
        }
    }
}

/** `sizing_json` 의 저장 포맷. 판별자는 위와 같은 이유로 고정이다. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = PositionSizingPayload.FixedKrw::class, name = "FIXED_KRW"),
    JsonSubTypes.Type(value = PositionSizingPayload.PercentBalance::class, name = "PERCENT_BALANCE"),
    JsonSubTypes.Type(value = PositionSizingPayload.FixedQuantity::class, name = "FIXED_QUANTITY"),
)
sealed class PositionSizingPayload {
    data class FixedKrw(val amountKrw: BigDecimal) : PositionSizingPayload()
    data class PercentBalance(val percent: BigDecimal) : PositionSizingPayload()
    data class FixedQuantity(val quantity: BigDecimal) : PositionSizingPayload()

    fun toDomain(): PositionSizing = when (this) {
        is FixedKrw -> com.kgd.quant.domain.strategy.FixedKrw(amountKrw)
        is PercentBalance -> com.kgd.quant.domain.strategy.PercentBalance(percent)
        is FixedQuantity -> com.kgd.quant.domain.strategy.FixedQuantity(quantity)
    }

    companion object {
        fun from(sizing: PositionSizing): PositionSizingPayload = when (sizing) {
            is com.kgd.quant.domain.strategy.FixedKrw -> FixedKrw(sizing.amountKrw)
            is com.kgd.quant.domain.strategy.PercentBalance -> PercentBalance(sizing.percent)
            is com.kgd.quant.domain.strategy.FixedQuantity -> FixedQuantity(sizing.quantity)
        }
    }
}
