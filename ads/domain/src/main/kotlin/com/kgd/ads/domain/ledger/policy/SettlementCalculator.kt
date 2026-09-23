package com.kgd.ads.domain.ledger.policy

/**
 * 한 (캠페인, KST 시각)의 청구액 = min(그 시각 지출, 그 날 일예산 − 그 날 청구 누계,
 * 총예산 − 청구 누계, 지갑 잔액). 넘친 지출은 청구하지 않는다 — 광고주는 예산 이상 내지 않는다.
 */
object SettlementCalculator {
    fun charge(
        hourSpendMicros: Long,
        dailyBudgetMicros: Long,
        chargedTodayMicros: Long,
        totalBudgetMicros: Long?,
        chargedTotalMicros: Long,
        walletBalanceMicros: Long,
    ): Long = minOf(
        hourSpendMicros,
        dailyBudgetMicros - chargedTodayMicros,
        totalBudgetMicros?.let { it - chargedTotalMicros } ?: Long.MAX_VALUE,
        walletBalanceMicros,
    ).coerceAtLeast(0)
}
