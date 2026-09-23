package com.kgd.ads.domain.decision.policy

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.LocalDateTime

class WalletHeadroomTest : BehaviorSpec({
    fun hour(h: Int): LocalDateTime = LocalDateTime.of(2026, 9, 23, h, 0)

    given("지갑 여유") {
        `when`("정산 완료 시각이 09시이고 09·10·11시에 지출이 있으면") {
            then("스냅샷 잔액에서 10·11시 지출만 뺀다 — 09시는 이미 잔액에 반영됐다") {
                val headroom = WalletHeadroom.of(
                    snapshotBalanceMicros = 10_000,
                    settledThroughHour = hour(9),
                    spendByHour = mapOf(hour(9) to 5_000L, hour(10) to 2_000L, hour(11) to 1_500L),
                    now = hour(11).plusMinutes(20),
                )
                headroom shouldBe WalletHeadroom.Available(6_500)
                (headroom as WalletHeadroom.Available).canAfford(6_500) shouldBe true
                headroom.canAfford(6_501) shouldBe false
            }
        }
        `when`("미정산 지출이 잔액을 넘으면") {
            then("여유가 0 이하라 1회 과금액을 감당하지 못한다") {
                val headroom = WalletHeadroom.of(1_000, hour(9), mapOf(hour(10) to 1_000L), hour(10).plusMinutes(30))
                (headroom as WalletHeadroom.Available).canAfford(1) shouldBe false
            }
        }
        `when`("정산 완료 뒤 미정산이 정확히 6시간이면") {
            then("아직 후보로 남는다") {
                // 09시까지 정산 → 10시부터 미정산, 16:00 에 6시간
                WalletHeadroom.of(10_000, hour(9), emptyMap(), hour(16)).shouldBeInstanceOf<WalletHeadroom.Available>()
            }
        }
        `when`("미정산이 6시간을 넘으면") {
            then("그 광고주는 후보에서 빠진다") {
                WalletHeadroom.of(10_000, hour(9), emptyMap(), hour(16).plusSeconds(1)) shouldBe WalletHeadroom.StaleSettlement
            }
        }
        `when`("아직 한 번도 정산되지 않았으면") {
            then("가장 이른 지출 시각부터 미정산으로 센다") {
                WalletHeadroom.of(10_000, null, mapOf(hour(9) to 100L), hour(12)) shouldBe WalletHeadroom.Available(9_900)
                WalletHeadroom.of(10_000, null, mapOf(hour(9) to 100L), hour(15).plusMinutes(1)) shouldBe WalletHeadroom.StaleSettlement
                WalletHeadroom.of(10_000, null, emptyMap(), hour(23)) shouldBe WalletHeadroom.Available(10_000)
            }
        }
    }
})
