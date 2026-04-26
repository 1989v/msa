package com.kgd.quant.infrastructure.exchange

import com.kgd.quant.application.port.exchange.SlippageModel
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.order.OrderSide
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.math.BigDecimal

/**
 * FixedSlippageModel — 고정 비율 슬리피지 (TG-P2-08).
 *
 * 매수: tick × (1 + rate) — 더 비싸게 체결
 * 매도: tick × (1 - rate) — 더 싸게 체결
 *
 * 기본 rate = 0.0005 (0.05%). `quant.paper.slippage.rate` 로 override.
 *
 * ## 결정론
 * - 입력 (tick, side) 가 같으면 출력 Price 도 항상 동일.
 * - BigDecimal 산술이라 부동소수점 오차 없음.
 */
@Component
class FixedSlippageModel(
    @Value("\${quant.paper.slippage.rate:0.0005}") private val rate: BigDecimal
) : SlippageModel {

    override fun apply(tick: Price, side: OrderSide): Price {
        val factor = when (side) {
            OrderSide.BUY -> BigDecimal.ONE + rate
            OrderSide.SELL -> BigDecimal.ONE - rate
        }
        return Price(tick.value.multiply(factor))
    }
}
