package com.kgd.order.domain.sheet.model

import java.math.BigInteger

/**
 * 안분 — 주문 단위 할인(쿠폰·포인트)을 라인 금액 비율로 나눈다.
 *
 * 각 라인은 내림(총액 × 라인 금액 / 금액 합)을 받고, 남은 원 단위 잔차는 금액이 가장 큰 라인(동률이면 앞 라인)이
 * 받는다. 라인 합은 언제나 총액과 같다. 잔차가 그 라인의 남은 금액보다 크면(할인이 금액 합에 거의 닿을 때)
 * 그 라인은 자기 금액까지만 받고 나머지는 다음으로 큰 라인이 받는다 — 라인 결제액이 음수가 되지 않게.
 */
object Allocation {

    fun allocate(total: Long, bases: List<Long>): List<Long> {
        require(total >= 0) { "안분할 금액은 음수일 수 없다" }
        require(bases.all { it >= 0 }) { "라인 금액은 음수일 수 없다" }
        val sum = bases.fold(0L) { acc, b -> Math.addExact(acc, b) }
        require(total <= sum) { "안분할 금액($total)이 라인 금액 합($sum)보다 크다" }
        if (total == 0L) return bases.map { 0L }

        val bigTotal = BigInteger.valueOf(total)
        val bigSum = BigInteger.valueOf(sum)
        val shares = bases.map { bigTotal.multiply(BigInteger.valueOf(it)).divide(bigSum).toLong() }.toMutableList()

        var residual = total - shares.sum()
        // 금액 내림차순, 같으면 앞 라인 먼저 (sortedByDescending 은 안정 정렬)
        for (i in bases.indices.sortedByDescending { bases[it] }) {
            if (residual == 0L) break
            val add = minOf(residual, bases[i] - shares[i])
            shares[i] += add
            residual -= add
        }
        check(residual == 0L) { "안분 잔차가 남았다: $residual" }
        return shares
    }
}
