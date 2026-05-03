package com.kgd.quant.domain.market

/**
 * MarketCode — 거래소/데이터 소스 식별자 (예: "BITHUMB", "UPBIT", "YAHOO", "FDR_KR").
 */
@JvmInline
value class MarketCode(val value: String) {
    init {
        require(value.isNotBlank()) { "MarketCode must not be blank" }
        require(PATTERN.matches(value)) { "MarketCode must match $PATTERN (got '$value')" }
    }

    override fun toString(): String = value

    companion object {
        private val PATTERN = Regex("^[A-Z0-9_]+$")
    }
}
