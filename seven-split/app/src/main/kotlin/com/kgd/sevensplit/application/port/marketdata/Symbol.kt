package com.kgd.sevensplit.application.port.marketdata

/**
 * Symbol — 시장 심볼 식별자 (예: "BTC/KRW", "ETH-USDT").
 *
 * 거래소마다 표기 규칙이 달라 opaque 문자열 wrapper 로 둔다. 거래소별 정규화는 구현체 책임.
 */
@JvmInline
value class Symbol(val value: String) {
    init {
        require(value.isNotBlank()) { "Symbol must not be blank" }
    }

    override fun toString(): String = value
}
