package com.kgd.ads.application.ledger.port

import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransactionType
import java.time.LocalDateTime

interface LedgerPort {
    fun openWallet(advertiserId: Long, now: LocalDateTime)
    fun findWalletAccountId(advertiserId: Long): Long?
    fun systemAccountId(type: LedgerAccountType): Long
    fun balanceOf(accountId: Long): Long

    /**
     * 거래 하나를 기록한다 — 관련 원장 계정 행을 id 순으로 잠그고, 거래·분개를 넣고, 잔액을 옮긴다.
     * 반드시 호출자의 ads 트랜잭션 안에서 돈다(잔액 갱신과 분개가 한 커밋이어야 한다).
     * @return 거래 id
     */
    fun post(posting: LedgerPosting): Long
}

/** 분개 합이 0 인 거래만 만들 수 있다. */
class LedgerPosting(
    val type: LedgerTransactionType,
    val idempotencyKey: String,
    val actorMemberId: Long?,
    val lines: List<LedgerLine>,
    val at: LocalDateTime,
) {
    init {
        require(lines.size >= 2) { "분개는 두 줄 이상이어야 합니다" }
        require(lines.none { it.amountMicros == 0L }) { "0 원 분개는 만들 수 없습니다" }
        require(lines.sumOf { it.amountMicros } == 0L) { "분개 합이 0 이 아닙니다" }
    }
}

data class LedgerLine(val accountId: Long, val amountMicros: Long)
