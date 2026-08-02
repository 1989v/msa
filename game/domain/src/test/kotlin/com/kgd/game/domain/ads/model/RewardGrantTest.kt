package com.kgd.game.domain.ads.model

import com.kgd.game.domain.ads.exception.RewardAlreadySettledException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class RewardGrantTest : BehaviorSpec({

    val now = Instant.parse("2026-08-02T12:00:00Z")

    fun newGrant() = RewardGrant.issue(
        idempotencyKey = "rw-1",
        placementKey = "game-rewarded",
        gameId = 5L,
        sessionKey = "sess-1",
        memberId = 7L,
        now = now,
    )

    given("보상 완료 시") {
        `when`("PENDING 상태면") {
            then("COMPLETED 로 전이하고 settledAt이 기록되어야 한다") {
                val grant = newGrant()
                grant.complete(now.plusSeconds(30))
                grant.status shouldBe RewardStatus.COMPLETED
                grant.settledAt shouldBe now.plusSeconds(30)
            }
        }

        `when`("이미 COMPLETED 면 (중복 콜백)") {
            then("멱등 — 예외 없이 최초 settledAt을 유지해야 한다") {
                val grant = newGrant()
                grant.complete(now.plusSeconds(30))
                grant.complete(now.plusSeconds(90))
                grant.settledAt shouldBe now.plusSeconds(30)
            }
        }

        `when`("FAILED 상태에서 완료를 시도하면") {
            then("RewardAlreadySettledException이 발생해야 한다") {
                val grant = newGrant()
                grant.fail(now)
                shouldThrow<RewardAlreadySettledException> { grant.complete(now.plusSeconds(10)) }
            }
        }
    }
})
