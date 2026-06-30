package com.kgd.game.application

import com.kgd.game.domain.BoardKey
import com.kgd.game.domain.Clock
import com.kgd.game.domain.DailyChallenge
import com.kgd.game.domain.DailyChallengePort
import com.kgd.game.domain.LeaderboardEntry
import com.kgd.game.domain.LeaderboardPort
import com.kgd.game.domain.Player
import com.kgd.game.domain.PlayerId
import com.kgd.game.domain.PlayerStore
import com.kgd.game.domain.SeedSource
import com.kgd.game.domain.SessionId
import com.kgd.game.domain.SessionStore
import com.kgd.game.domain.SessionTokenService
import com.kgd.game.domain.StoredReplay
import com.kgd.game.domain.GameSession
import com.kgd.game.domain.ReplayStore
import com.kgd.game.domain.VerificationStatus
import com.kgd.game.infrastructure.InMemoryGameRegistry
import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.InputEvent
import com.kgd.game.sim.ReplayLog
import com.kgd.game.sim.SimRunner
import com.kgd.game.sim.games.SnakeGame
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.util.concurrent.ConcurrentHashMap

private class FakeClock(var now: Long = 0) : Clock {
    override fun nowEpochMs() = now
}

private class FakeSessions : SessionStore {
    private val map = ConcurrentHashMap<String, GameSession>()
    override fun save(session: GameSession) { map[session.id.value] = session }
    override fun find(id: SessionId) = map[id.value]
}

/** 발급 토큰 = 페이로드 그대로(검증은 동일 재계산) — 서명 의미만 모사. */
private class FakeTokens : SessionTokenService {
    override fun issue(sessionId: SessionId, seed: Int, startedEpochMs: Long) = "${sessionId.value}|$seed|$startedEpochMs"
    override fun verify(token: String, sessionId: SessionId, seed: Int, startedEpochMs: Long) =
        token == issue(sessionId, seed, startedEpochMs)
}

private class FakeReplays : ReplayStore {
    val saved = ConcurrentHashMap<String, StoredReplay>()
    override fun save(stored: StoredReplay) { saved[stored.sessionId.value] = stored }
    override fun updateStatus(sessionId: SessionId, status: VerificationStatus) {
        saved[sessionId.value]?.let { saved[sessionId.value] = it.copy(status = status) }
    }
}

private class FakePlayers : PlayerStore {
    private val byNick = ConcurrentHashMap<String, Player>()
    override fun createGuest(nickname: String) = Player(PlayerId("guest-$nickname"), nickname, registered = false)
    override fun registerOrGet(nickname: String) =
        byNick.getOrPut(nickname.lowercase()) { Player(PlayerId("user-$nickname"), nickname, registered = true) }
    override fun find(id: PlayerId) = byNick.values.firstOrNull { it.id == id }
}

private class FakeLeaderboard : LeaderboardPort {
    private data class Row(val nickname: String, var score: Int, var status: VerificationStatus)
    private val boards = HashMap<BoardKey, HashMap<PlayerId, Row>>()
    private fun b(key: BoardKey) = boards.getOrPut(key) { HashMap() }
    override fun submit(board: BoardKey, playerId: PlayerId, nickname: String, score: Int, status: VerificationStatus) {
        val row = b(board)[playerId]
        if (row == null) b(board)[playerId] = Row(nickname, score, status)
        else if (score > row.score) row.score = score
    }
    private fun ordered(board: BoardKey) = b(board).entries.sortedByDescending { it.value.score }
    override fun top(board: BoardKey, limit: Int) = ordered(board).take(limit).mapIndexed { i, e ->
        LeaderboardEntry(i + 1, e.key, e.value.nickname, e.value.score, e.value.status)
    }
    override fun rankOf(board: BoardKey, playerId: PlayerId): Int? {
        val idx = ordered(board).indexOfFirst { it.key == playerId }
        return if (idx < 0) null else idx + 1
    }
    override fun setStatus(board: BoardKey, playerId: PlayerId, status: VerificationStatus) {
        b(board)[playerId]?.status = status
    }
}

private class Env {
    val clock = FakeClock()
    val sessions = FakeSessions()
    val tokens = FakeTokens()
    val replays = FakeReplays()
    val players = FakePlayers()
    val leaderboard = FakeLeaderboard()
    val registry = InMemoryGameRegistry()
    val seeds = object : SeedSource { override fun newSeed() = 777 }
    val daily = object : DailyChallengePort {
        override fun current(gameId: String, date: String) = DailyChallenge(gameId, date, "$gameId:$date".hashCode())
    }
    val starter = StartSessionService(sessions, tokens, seeds, daily, clock)
    val submitter = SubmitScoreService(sessions, tokens, replays, players, leaderboard, registry, clock)
}

class SubmitScoreServiceTest : BehaviorSpec({

    val ticks = 80
    fun honestReplay(seed: Int) =
        ReplayLog("snake", seed, ticks, listOf(InputEvent(3, InputCommand.DOWN), InputEvent(9, InputCommand.RIGHT)))

    Given("an honestly played submission") {
        val e = Env()
        val started = e.starter.start("snake", isDaily = false, date = "2026-06-29")
        val replay = honestReplay(started.seed)
        val honest = SimRunner.run(SnakeGame(), replay).score
        e.clock.now = ticks.toLong() * 40 // 충분한 서버 경과

        When("the matching score is submitted") {
            val out = e.submitter.submit(SubmitCommand(started.sessionId, started.token, honest, replay, 3000, "kgd"))
            Then("accepted and Tier B confirms it at rank 1") {
                out.accepted shouldBe true
                out.verification shouldBe VerificationStatus.CONFIRMED
                out.allTimeRank shouldBe 1
            }
        }
    }

    Given("a plausible but forged score (passes Tier A, fails Tier B)") {
        val e = Env()
        val started = e.starter.start("snake", false, "2026-06-29")
        val replay = honestReplay(started.seed)
        val honest = SimRunner.run(SnakeGame(), replay).score
        e.clock.now = ticks.toLong() * 40

        When("claiming honest+1 (still within the per-tick bound)") {
            val out = e.submitter.submit(SubmitCommand(started.sessionId, started.token, honest + 1, replay, 3000, "cheater"))
            Then("accepted into provisional but Tier B rejects (replay recompute != claim)") {
                out.accepted shouldBe true
                out.verification shouldBe VerificationStatus.REJECTED
            }
        }
    }

    Given("an implausible forged score (exceeds the per-tick bound)") {
        val e = Env()
        val started = e.starter.start("snake", false, "2026-06-29")
        val replay = honestReplay(started.seed)
        e.clock.now = ticks.toLong() * 40

        When("claiming a score far above ticks") {
            val out = e.submitter.submit(SubmitCommand(started.sessionId, started.token, ticks + 500, replay, 3000, "cheater"))
            Then("Tier A rejects before any replay") {
                out.accepted shouldBe false
            }
        }
    }

    Given("a tampered token") {
        val e = Env()
        val started = e.starter.start("snake", false, "2026-06-29")
        val replay = honestReplay(started.seed)
        e.clock.now = ticks.toLong() * 40

        When("submitting with a bad token") {
            val out = e.submitter.submit(SubmitCommand(started.sessionId, "bogus", 1, replay, 3000, "x"))
            Then("rejected") { out.accepted shouldBe false }
        }
    }
})
