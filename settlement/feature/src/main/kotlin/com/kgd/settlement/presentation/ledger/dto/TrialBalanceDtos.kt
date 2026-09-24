package com.kgd.settlement.presentation.ledger.dto

import com.kgd.settlement.application.ledger.usecase.TrialBalance

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
