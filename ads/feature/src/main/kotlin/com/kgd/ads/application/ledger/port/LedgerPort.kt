package com.kgd.ads.application.ledger.port

import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransaction
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
    fun post(transaction: LedgerTransaction): Long
}

