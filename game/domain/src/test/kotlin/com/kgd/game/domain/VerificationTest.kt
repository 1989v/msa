package com.kgd.game.domain

import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.InputEvent
import com.kgd.game.sim.ReplayLog
import com.kgd.game.sim.SimRunner
import com.kgd.game.sim.games.SnakeGame
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class VerificationTest : BehaviorSpec({
    val snake = SnakeGame()

    Given("an honestly played replay") {
        val replay = ReplayLog(SnakeGame.ID, seed = 42, totalTicks = 50, inputs = listOf(InputEvent(2, InputCommand.DOWN)))
        val honest = SimRunner.run(snake, replay).score

        When("Tier B re-runs with the matching claimed score") {
            val sub = ScoreSubmission(SessionId("s1"), honest, replay, clientDurationMs = 3000, nickname = "kgd")
            val r = ReplayVerifier().verify(snake, sub)
            Then("it verifies and recomputes the same score") {
                r.verified shouldBe true
                r.recomputedScore shouldBe honest
            }
        }

        When("a forged higher score is claimed for the same replay") {
            val sub = ScoreSubmission(SessionId("s1"), honest + 999, replay, clientDurationMs = 3000, nickname = "kgd")
            val r = ReplayVerifier().verify(snake, sub)
            Then("Tier B rejects (recomputed != claimed)") {
                r.verified shouldBe false
                r.recomputedScore shouldBe honest
            }
        }
    }

    Given("Tier A plausibility checks") {
        val session = GameSession(
            SessionId("s1"), SnakeGame.ID, PlayerId("p1"),
            seed = 1, dailyDate = null, startedEpochMs = 0, status = SessionStatus.OPEN,
        )
        val checker = ScorePlausibility()

        When("claimed score exceeds the per-tick bound") {
            val sub = ScoreSubmission(
                SessionId("s1"), claimedScore = 100,
                ReplayLog(SnakeGame.ID, 1, totalTicks = 10, inputs = emptyList()),
                clientDurationMs = 5000, nickname = "k",
            )
            Then("rejected") {
                checker.verify(session, sub, nowEpochMs = 10_000).accepted shouldBe false
            }
        }

        When("a plausible score within the time budget") {
            val sub = ScoreSubmission(
                SessionId("s1"), claimedScore = 3,
                ReplayLog(SnakeGame.ID, 1, totalTicks = 100, inputs = emptyList()),
                clientDurationMs = 3500, nickname = "k",
            )
            Then("accepted") {
                // 100 ticks * 30ms = 3000ms 최소, 서버 경과 4000ms → OK
                checker.verify(session, sub, nowEpochMs = 4_000).accepted shouldBe true
            }
        }

        When("the submission arrives implausibly fast for its tick count") {
            val sub = ScoreSubmission(
                SessionId("s1"), claimedScore = 2,
                ReplayLog(SnakeGame.ID, 1, totalTicks = 100, inputs = emptyList()),
                clientDurationMs = 100, nickname = "k",
            )
            Then("rejected (server elapsed too small for ticks)") {
                checker.verify(session, sub, nowEpochMs = 200).accepted shouldBe false
            }
        }
    }
})
