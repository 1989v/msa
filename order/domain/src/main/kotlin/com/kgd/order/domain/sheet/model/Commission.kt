package com.kgd.order.domain.sheet.model

import java.math.BigDecimal
import java.math.RoundingMode

/** 판매 수수료 = 반올림(HALF_UP)(라인 순매출 × 수수료율 bp / 10000). 배송비에는 붙지 않는다 */
object Commission {
    private val BP_SCALE = BigDecimal.valueOf(10_000L)

    fun of(netSales: Long, rateBp: Int): Long {
        require(netSales >= 0) { "순매출은 음수일 수 없다" }
        require(rateBp in 0..10_000) { "수수료율은 0~10000bp" }
        return BigDecimal.valueOf(netSales).multiply(BigDecimal.valueOf(rateBp.toLong()))
            .divide(BP_SCALE, 0, RoundingMode.HALF_UP)
            .longValueExact()
    }
}
