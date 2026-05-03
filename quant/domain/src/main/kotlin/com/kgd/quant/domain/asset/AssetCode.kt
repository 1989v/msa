package com.kgd.quant.domain.asset

/**
 * AssetCode — 자산 식별 문자열 (예: "BTC", "AAPL", "005930").
 *
 * 형식 규약:
 * - 공백 금지
 * - 대문자/숫자/언더스코어/하이픈만 허용 (정규식 `[A-Z0-9_-]+`)
 * - 1~32 자
 *
 * 거래소별 ticker 매핑은 인프라 어댑터가 담당 — 도메인은 단일 코드만 본다.
 */
@JvmInline
value class AssetCode(val value: String) {
    init {
        require(value.isNotBlank()) { "AssetCode must not be blank" }
        require(value.length in 1..32) { "AssetCode length 1..32 (got ${value.length})" }
        require(PATTERN.matches(value)) { "AssetCode must match $PATTERN (got '$value')" }
    }

    override fun toString(): String = value

    companion object {
        private val PATTERN = Regex("^[A-Z0-9_-]+$")
    }
}
