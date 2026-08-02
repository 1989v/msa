package com.kgd.game.domain.play.model

import com.kgd.game.domain.play.exception.RunAlreadyConsumedException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class GameRunTest : BehaviorSpec({

    val now = Instant.parse("2026-08-02T10:00:00Z")

    fun newRun(memberId: Long? = null) =
        GameRun.start(runKey = "run-1", gameId = 1L, memberId = memberId, seed = 42L, now = now)

    given("런 시작 시") {
        `when`("게스트로 시작하면") {
            then("ACTIVE 상태 + 발급 시드를 가져야 한다") {
                val run = newRun()
                run.status shouldBe RunStatus.ACTIVE
                run.seed shouldBe 42L
                run.memberId shouldBe null
                run.isActive() shouldBe true
            }
        }
    }

    given("런 종료(consume) 시") {
        `when`("ACTIVE 런을 CLEAR로 종료하면") {
            then("CONSUMED + outcome + consumedAt이 기록되어야 한다") {
                val run = newRun(memberId = 7L)
                run.consume(outcome = "CLEAR", now = now.plusSeconds(600))

                run.status shouldBe RunStatus.CONSUMED
                run.outcome shouldBe "CLEAR"
                run.consumedAt shouldBe now.plusSeconds(600)
            }
        }

        `when`("이미 종료된 런을 다시 종료하면") {
            then("RunAlreadyConsumedException이 발생해야 한다 (재로드 차단)") {
                val run = newRun()
                run.consume(outcome = "DEATH", now = now)
                shouldThrow<RunAlreadyConsumedException> {
                    run.consume(outcome = "CLEAR", now = now)
                }
            }
        }

        `when`("outcome이 32자를 넘으면") {
            then("32자로 잘려 저장되어야 한다") {
                val run = newRun()
                run.consume(outcome = "x".repeat(50), now = now)
                run.outcome shouldBe "x".repeat(32)
            }
        }
    }
})
