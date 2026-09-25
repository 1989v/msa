package com.kgd.settlement.presentation.ledger.dto

import com.kgd.settlement.application.ledger.usecase.TrialBalance
import com.kgd.settlement.domain.ledger.model.Journal
import java.time.Instant

/** 시산표 — 계정은 영문 코드 + 한글 이름. [net] 이 0 이 아니면 원장이 깨졌다 */
data class TrialBalanceResponse(
    val accounts: List<AccountRow>,
    val sellerPayables: List<SellerPayableRow>,
    val totalDebit: Long,
    val totalCredit: Long,
    val net: Long,
) {
    data class AccountRow(val code: String, val name: String, val debit: Long, val credit: Long, val balance: Long)

    data class SellerPayableRow(val sellerId: Long, val balance: Long)

    companion object {
        fun of(tb: TrialBalance) = TrialBalanceResponse(
            accounts = tb.accounts.map { AccountRow(it.account.name, it.account.displayName, it.debit, it.credit, it.balance) },
            sellerPayables = tb.sellerPayables.map { SellerPayableRow(it.sellerId, it.balance) },
            totalDebit = tb.totalDebit,
            totalCredit = tb.totalCredit,
            net = tb.net,
        )
    }
}

data class ReverseJournalRequest(val reason: String? = null)

/** 원장 거래 한 건 — 역분개면 [reversalOf] 가 원 거래, [actorId]·[reason] 이 누가 왜 */
data class JournalResponse(
    val id: Long,
    val type: String,
    val sourceKey: String,
    val orderId: Long?,
    val reversalOf: Long?,
    val actorId: String?,
    val reason: String?,
    val occurredAt: Instant,
    val entries: List<EntryRow>,
) {
    data class EntryRow(val code: String, val name: String, val side: String, val amount: Long, val sellerId: Long?)

    companion object {
        fun of(j: Journal) = JournalResponse(
            id = requireNotNull(j.id), type = j.type.name, sourceKey = j.sourceKey, orderId = j.orderId, reversalOf = j.reversalOf,
            actorId = j.actorId, reason = j.reason, occurredAt = j.occurredAt,
            entries = j.entries.map { EntryRow(it.account.name, it.account.displayName, it.side.name, it.amount, it.sellerId) },
        )
    }
}
