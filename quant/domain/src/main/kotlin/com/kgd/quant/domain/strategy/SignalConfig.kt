package com.kgd.quant.domain.strategy

import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal

/**
 * SignalConfig — single-source 시그널의 파라미터 sealed (ADR-0033 Phase 1).
 *
 * 4종 시그널 (확장 시 본 sealed 의 자식 추가):
 *
 * - [VolumeSpike]      거래량 급증
 * - [RsiBreakout]      RSI 상/하단 돌파
 * - [MaCross]          이동평균 골든/데드 크로스
 * - [BollingerSqueeze] 볼린저 밴드 squeeze 후 확장
 *
 * 시그널 평가는 application 레이어의 ta4j 기반 IndicatorCalculator 가 담당.
 * 도메인은 파라미터 정합성만 보장한다.
 */
sealed interface SignalConfig {
    fun describe(): String
}

data class VolumeSpike(
    /** 직전 [window] 봉 평균 대비 배수 — 1.5 ~ 10.0 권장. */
    val multiplier: BigDecimal,
    /** 비교 윈도우 (봉 수) — 5 ~ 200. */
    val window: Int,
) : SignalConfig {
    init {
        require(multiplier > BigDecimal.ONE) { "multiplier must be > 1.0 (got $multiplier)" }
        require(window in 5..500) { "window must be in 5..500 (got $window)" }
    }

    override fun describe(): String = "VolumeSpike x$multiplier @ ${window}봉"
}

data class RsiBreakout(
    /** RSI 계산 기간 — 일반적으로 14. */
    val period: Int,
    /** 진입 임계 — OVERSOLD 면 < threshold, OVERBOUGHT 면 > threshold. */
    val threshold: BigDecimal,
    val direction: Direction,
) : SignalConfig {
    init {
        require(period in 2..200) { "period must be in 2..200 (got $period)" }
        require(threshold in BigDecimal("0") .. BigDecimal("100")) {
            "threshold must be 0..100 (got $threshold)"
        }
    }

    override fun describe(): String = "RSI($period) ${direction.symbol} $threshold"

    enum class Direction(val symbol: String) {
        OVERSOLD("<"),
        OVERBOUGHT(">"),
    }
}

data class MaCross(
    val fastPeriod: Int,
    val slowPeriod: Int,
    val direction: CrossDirection,
) : SignalConfig {
    init {
        require(fastPeriod in 2..200) { "fastPeriod must be in 2..200 (got $fastPeriod)" }
        require(slowPeriod in 2..500) { "slowPeriod must be in 2..500 (got $slowPeriod)" }
        require(fastPeriod < slowPeriod) {
            "fastPeriod($fastPeriod) must be < slowPeriod($slowPeriod)"
        }
    }

    override fun describe(): String = "MA($fastPeriod/$slowPeriod) ${direction.label}"

    enum class CrossDirection(val label: String) {
        GOLDEN("골든"),
        DEAD("데드"),
    }
}

/**
 * KimchiPremiumThreshold — 김치프리미엄(거래소 간 가격 차이) 진입/청산 임계 (ADR-0036 Phase 2).
 *
 * - entry: 프리미엄 ≥ entryThresholdPercent 일 때 진입 후보
 * - exit:  프리미엄 ≤ exitThresholdPercent 일 때 청산
 *
 * SignalStrategy 의 `market` 은 KR 측 (예: BITHUMB), [foreignMarket] 은 비교 대상 해외 거래소
 * (예: BINANCE/BYBIT). 백테스트는 `quant.kimchi_premium_tick(asset_code, kr_market, foreign_market, ts)`
 * 시계열을 read 한다.
 *
 * 계산 공식은 application/kimchi/KimchiPremiumCalculator 참조.
 */
data class KimchiPremiumThreshold(
    val entryThresholdPercent: BigDecimal,
    val exitThresholdPercent: BigDecimal,
    val foreignMarket: MarketCode,
) : SignalConfig {
    init {
        require(entryThresholdPercent > exitThresholdPercent) {
            "entry($entryThresholdPercent) must be > exit($exitThresholdPercent)"
        }
        require(entryThresholdPercent in BigDecimal("-50") .. BigDecimal("50")) {
            "entryThresholdPercent must be in -50..50 (got $entryThresholdPercent)"
        }
    }
    override fun describe(): String =
        "KimchiPremium(vs ${foreignMarket.value}) entry≥${entryThresholdPercent}% / exit≤${exitThresholdPercent}%"
}

data class BollingerSqueeze(
    /** BB 계산 기간 — 일반적으로 20. */
    val period: Int,
    /** 표준편차 배수 — 일반적으로 2.0. */
    val stdDev: BigDecimal,
    /** squeeze 임계 (밴드폭 비율) — 0.0..1.0. 작을수록 강한 squeeze. */
    val squeezeThreshold: BigDecimal,
) : SignalConfig {
    init {
        require(period in 5..200) { "period must be in 5..200 (got $period)" }
        require(stdDev > BigDecimal.ZERO) { "stdDev must be > 0 (got $stdDev)" }
        require(squeezeThreshold > BigDecimal.ZERO && squeezeThreshold < BigDecimal.ONE) {
            "squeezeThreshold must be in (0, 1) (got $squeezeThreshold)"
        }
    }

    override fun describe(): String = "BB($period, ${stdDev}σ) squeeze<$squeezeThreshold"
}
