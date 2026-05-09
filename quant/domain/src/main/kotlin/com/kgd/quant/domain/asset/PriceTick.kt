package com.kgd.quant.domain.asset

import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant

/**
 * PriceTick — 실시간 가격 변경 단위 (TG-13 SSE).
 *
 * polling 또는 ws 어떤 source 에서도 동일 형태로 publish.
 * volume 은 누적 또는 tick volume 으로 source 의 의미에 따라 다름.
 */
data class PriceTick(
    val asset: AssetCode,
    val market: MarketCode,
    val price: BigDecimal,
    val volume: BigDecimal? = null,
    val ts: Instant,
)
