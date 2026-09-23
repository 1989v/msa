package com.kgd.ads.domain.ledger.model

/** 분개 한 줄 — 원장 계정 하나의 증감(마이크로). 0 원 분개는 없다. */
data class LedgerEntry(val accountId: Long, val amountMicros: Long) {
    init {
        require(amountMicros != 0L) { "0 원 분개는 만들 수 없습니다" }
    }
}
