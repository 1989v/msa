package com.kgd.ads.domain.ledger.policy

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.data.forAll
import io.kotest.data.row
import io.kotest.matchers.shouldBe

class RevenueSplitTest : BehaviorSpec({
    given("기본 배분율 68%") {
        `when`("청구액이 작아 몫에 소수점이 생기면") {
            then("퍼블리셔 몫은 내림, 나머지는 수수료 — 둘의 합은 청구액") {
                forAll(
                    row(1L, 0L, 1L),
                    row(3L, 2L, 1L),
                    row(7L, 4L, 3L),
                    row(1_000_000L, 680_000L, 320_000L),
                ) { charge, share, fee ->
                    val split = RevenueSplit.of(charge)
                    split.publisherShareMicros shouldBe share
                    split.networkFeeMicros shouldBe fee
                    (split.publisherShareMicros + split.networkFeeMicros) shouldBe charge
                }
            }
        }
    }
})
