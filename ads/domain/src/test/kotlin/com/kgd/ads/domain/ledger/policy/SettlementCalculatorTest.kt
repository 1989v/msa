package com.kgd.ads.domain.ledger.policy

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class SettlementCalculatorTest : BehaviorSpec({
    fun charge(
        spend: Long,
        daily: Long = 10_000,
        chargedToday: Long = 0,
        total: Long? = 100_000,
        chargedTotal: Long = 0,
        wallet: Long = 1_000_000,
    ) = SettlementCalculator.charge(
        hourSpendMicros = spend,
        dailyBudgetMicros = daily,
        chargedTodayMicros = chargedToday,
        totalBudgetMicros = total,
        chargedTotalMicros = chargedTotal,
        walletBalanceMicros = wallet,
    )

    given("한 시각의 청구액") {
        `when`("지출이 가장 작으면") { then("지출 전액") { charge(spend = 3_000) shouldBe 3_000 } }
        `when`("그 날 일예산 여유가 가장 작으면") { then("일예산 − 그 날 청구 누계") { charge(spend = 3_000, chargedToday = 8_500) shouldBe 1_500 } }
        `when`("총예산 여유가 가장 작으면") { then("총예산 − 청구 누계") { charge(spend = 3_000, chargedTotal = 99_000) shouldBe 1_000 } }
        `when`("지갑 잔액이 가장 작으면") { then("지갑 잔액") { charge(spend = 3_000, wallet = 700) shouldBe 700 } }
        `when`("총예산이 없으면") { then("총예산은 제한하지 않는다") { charge(spend = 3_000, total = null, chargedTotal = 5_000_000) shouldBe 3_000 } }
        `when`("일예산을 이미 다 썼으면") { then("0 — 음수로 내려가지 않는다") { charge(spend = 3_000, chargedToday = 12_000) shouldBe 0 } }
    }

    given("같은 날 여러 시각을 차례로 정산하면") {
        `when`("지출 4,000 이 세 시각 이어지고 일예산이 10,000") {
            then("청구는 4,000 · 4,000 · 2,000 으로 일예산에서 멈춘다") {
                var chargedToday = 0L
                val charges = listOf(4_000L, 4_000L, 4_000L).map { spend ->
                    charge(spend = spend, chargedToday = chargedToday, chargedTotal = chargedToday).also { chargedToday += it }
                }
                charges shouldBe listOf(4_000L, 4_000L, 2_000L)
                chargedToday shouldBe 10_000
            }
        }
    }
})
