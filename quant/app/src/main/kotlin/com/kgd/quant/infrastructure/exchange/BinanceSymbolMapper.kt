package com.kgd.quant.infrastructure.exchange

import com.kgd.quant.domain.asset.AssetCode

/**
 * BinanceSymbolMapper — 도메인 [AssetCode] ↔ Binance ticker symbol 변환 (P2-T02).
 *
 * 규약:
 * - quote 자산은 USDT 가 default (Phase 2 단순화 — USDC 는 Phase 3)
 * - 도메인 코드가 이미 USDT pair 형태(예: "BTCUSDT") 면 그대로 전달
 * - Phase 1 의 일반 자산 코드(예: "BTC") 는 USDT 페어로 매핑("BTCUSDT")
 */
object BinanceSymbolMapper {

    private const val DEFAULT_QUOTE = "USDT"

    fun toBinanceSymbol(asset: AssetCode): String {
        val v = asset.value.uppercase()
        return if (v.endsWith(DEFAULT_QUOTE)) v else "$v$DEFAULT_QUOTE"
    }

    fun fromBinanceSymbol(symbol: String): AssetCode {
        val v = symbol.uppercase()
        val base = if (v.endsWith(DEFAULT_QUOTE)) v.dropLast(DEFAULT_QUOTE.length) else v
        return AssetCode(base)
    }
}
