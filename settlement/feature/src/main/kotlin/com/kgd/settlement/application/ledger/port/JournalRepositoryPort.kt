package com.kgd.settlement.application.ledger.port

import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.Journal

/**
 * 원장 저장소 — **추가와 조회만** 있다. 수정·삭제 메서드를 두지 않아 원장을 고치는 코드를 쓸 수 없다(정정은 역분개 거래).
 * 같은 원천 키는 저장소도 유니크로 막는다(`uk_ledger_journal_source`).
 */
interface JournalRepositoryPort {
    fun existsBySourceKey(sourceKey: String): Boolean

    fun findById(id: Long): Journal?

    fun findBySourceKey(sourceKey: String): Journal?

    fun append(journal: Journal): Journal

    /** 계정별 차변 합·대변 합 */
    fun sumByAccount(): List<AccountBalance>

    /** 판매자별 미지급금 잔액(대 − 차) — 0 인 판매자도 원장에 줄이 있으면 나온다 */
    fun sellerPayableBalances(): Map<Long, Long>
}

data class AccountBalance(val account: Account, val debit: Long, val credit: Long) {
    /** 차 − 대 */
    val balance: Long get() = debit - credit
}
