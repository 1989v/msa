package com.kgd.ads.application.ledger.port

import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransaction
import java.time.LocalDateTime

/**
 * 원장 읽기·쓰기. 잔액을 보고 판단하는 호출자(충전 한도·정산 청구액)는 [lockAccounts] 로 먼저 잠그고,
 * 그 트랜잭션을 READ COMMITTED 로 연다 — REPEATABLE READ 는 잠금을 기다리는 동안 커밋된 합계를 못 본다.
 */
interface LedgerPort {
    fun openWallet(advertiserId: Long, now: LocalDateTime)
    fun findWalletAccountId(advertiserId: Long): Long?
    fun systemAccountId(type: LedgerAccountType): Long
    fun balanceOf(accountId: Long): Long

    /**
     * 원장 계정 행을 id 순으로 `FOR UPDATE` 잠그고 잠근 뒤의 잔액을 돌려준다. 호출자의 ads 트랜잭션 안에서만 돈다.
     * @return 계정 id → 잔액
     */
    fun lockAccounts(accountIds: Collection<Long>): Map<Long, Long>

    fun findTransactionId(idempotencyKey: String): Long?

    /** 지갑에 [from, until) 동안 들어온 충전 합. */
    fun sumTopUps(walletAccountId: Long, from: LocalDateTime, until: LocalDateTime): Long

    /** 전체 분개 합 — 복식부기가 지켜졌으면 0 이다. */
    fun sumAllEntries(): Long

    /**
     * 거래 하나를 기록한다 — 관련 원장 계정 행을 id 순으로 잠그고, 거래·분개를 넣고, 잔액을 옮긴다.
     * 반드시 호출자의 ads 트랜잭션 안에서 돈다(잔액 갱신과 분개가 한 커밋이어야 한다).
     * 같은 멱등 키의 거래가 이미 있으면 아무것도 쓰지 않고 그 거래 id 를 돌려준다.
     * 지갑이 음수가 되는 거래는 예외로 거절한다.
     * @return 거래 id
     */
    fun post(transaction: LedgerTransaction): Long
}
