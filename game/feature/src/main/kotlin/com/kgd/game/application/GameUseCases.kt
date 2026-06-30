package com.kgd.game.application

import com.kgd.game.domain.BoardKey
import com.kgd.game.domain.Clock
import com.kgd.game.domain.DailyChallengePort
import com.kgd.game.domain.GameRegistry
import com.kgd.game.domain.GameSession
import com.kgd.game.domain.LeaderboardPeriod
import com.kgd.game.domain.LeaderboardPort
import com.kgd.game.domain.PlayerStore
import com.kgd.game.domain.ReplayVerifier
import com.kgd.game.domain.ReplayStore
import com.kgd.game.domain.ScorePlausibility
import com.kgd.game.domain.ScoreSubmission
import com.kgd.game.domain.SeedSource
import com.kgd.game.domain.SessionId
import com.kgd.game.domain.SessionStatus
import com.kgd.game.domain.SessionStore
import com.kgd.game.domain.SessionTokenService
import com.kgd.game.domain.StoredReplay
import com.kgd.game.domain.VerificationStatus
import com.kgd.game.sim.ReplayLog
import org.springframework.stereotype.Service
import java.util.UUID

data class StartedSession(
    val sessionId: SessionId,
    val gameId: String,
    val seed: Int,
    val dailyDate: String?,
    val token: String,
)

/** 세션 시작 — 서버가 seed(데일리면 공통, 자유면 랜덤) 발급 + 서명 토큰 + start_ts 기록. */
@Service
class StartSessionService(
    private val sessions: SessionStore,
    private val tokens: SessionTokenService,
    private val seeds: SeedSource,
    private val daily: DailyChallengePort,
    private val clock: Clock,
) {
    fun start(gameId: String, isDaily: Boolean, date: String): StartedSession {
        val seed: Int
        val dailyDate: String?
        if (isDaily) {
            val ch = daily.current(gameId, date)
            seed = ch.seed
            dailyDate = ch.date
        } else {
            seed = seeds.newSeed()
            dailyDate = null
        }
        val now = clock.nowEpochMs()
        val id = SessionId(UUID.randomUUID().toString())
        sessions.save(GameSession(id, gameId, playerId = null, seed = seed, dailyDate = dailyDate, startedEpochMs = now, status = SessionStatus.OPEN))
        return StartedSession(id, gameId, seed, dailyDate, tokens.issue(id, seed, now))
    }
}

data class SubmitCommand(
    val sessionId: SessionId,
    val token: String,
    val claimedScore: Int,
    val replay: ReplayLog,
    val clientDurationMs: Long,
    val nickname: String,
)

data class SubmitOutcome(
    val accepted: Boolean,
    val score: Int = 0,
    val verification: VerificationStatus = VerificationStatus.REJECTED,
    val allTimeRank: Int = -1,
    val dailyRank: Int? = null,
    val reason: String? = null,
) {
    companion object {
        fun rejected(reason: String) = SubmitOutcome(accepted = false, reason = reason)
    }
}

/**
 * 점수 제출 — Tier A(경량) → 잠정 등재 → Tier B(상위 N 진입 시 풀 리플레이).
 * 토큰/세션/시간 정합으로 위조·무플레이를 거르고, 상위권만 결정적 코어 재실행으로 확정한다.
 */
@Service
class SubmitScoreService(
    private val sessions: SessionStore,
    private val tokens: SessionTokenService,
    private val replays: ReplayStore,
    private val players: PlayerStore,
    private val leaderboard: LeaderboardPort,
    private val registry: GameRegistry,
    private val clock: Clock,
) {
    private val plausibility = ScorePlausibility()
    private val replayVerifier = ReplayVerifier()

    fun submit(cmd: SubmitCommand): SubmitOutcome {
        val session = sessions.find(cmd.sessionId) ?: return SubmitOutcome.rejected("session not found")
        if (!tokens.verify(cmd.token, session.id, session.seed, session.startedEpochMs)) {
            return SubmitOutcome.rejected("invalid token")
        }
        if (cmd.replay.gameId != session.gameId || cmd.replay.seed != session.seed) {
            return SubmitOutcome.rejected("replay does not match session")
        }
        val submission = ScoreSubmission(session.id, cmd.claimedScore, cmd.replay, cmd.clientDurationMs, cmd.nickname)

        // Tier A — 게임 재실행 없는 경량 타당성.
        val tierA = plausibility.verify(session, submission, clock.nowEpochMs())
        if (!tierA.accepted) return SubmitOutcome.rejected("tierA: ${tierA.reason}")

        // 멱등: 세션을 SUBMITTED 로(중복 제출 방어 — MVP 단순 마킹).
        if (session.status != SessionStatus.OPEN) return SubmitOutcome.rejected("session already submitted")
        sessions.save(session.copy(status = SessionStatus.SUBMITTED))

        // MVP 가입-라이트: 닉네임 클레임 = 등록 계정(경쟁 랭킹 등재 게이트).
        val player = players.registerOrGet(cmd.nickname)
        replays.save(StoredReplay(session.id, cmd.replay, cmd.claimedScore, VerificationStatus.PROVISIONAL))

        val boards = boardsFor(session)
        boards.forEach { leaderboard.submit(it, player.id, player.nickname, cmd.claimedScore, VerificationStatus.PROVISIONAL) }

        // Tier B — 상위 N 진입 시에만 풀 리플레이(비용 절감, 설계대로).
        var status = VerificationStatus.PROVISIONAL
        val entersTopN = boards.any { (leaderboard.rankOf(it, player.id) ?: Int.MAX_VALUE) <= TIER_B_TOP_N }
        if (entersTopN) {
            val module = registry.module(session.gameId)
                ?: return SubmitOutcome.rejected("unknown game module")
            val tierB = replayVerifier.verify(module, submission)
            status = if (tierB.verified) VerificationStatus.CONFIRMED else VerificationStatus.REJECTED
            replays.updateStatus(session.id, status)
            boards.forEach { leaderboard.setStatus(it, player.id, status) }
        }

        return SubmitOutcome(
            accepted = true,
            score = cmd.claimedScore,
            verification = status,
            allTimeRank = leaderboard.rankOf(BoardKey(session.gameId, LeaderboardPeriod.ALL_TIME, null), player.id) ?: -1,
            dailyRank = session.dailyDate?.let { leaderboard.rankOf(BoardKey(session.gameId, LeaderboardPeriod.DAILY, it), player.id) },
        )
    }

    private fun boardsFor(session: GameSession): List<BoardKey> = buildList {
        add(BoardKey(session.gameId, LeaderboardPeriod.ALL_TIME, null))
        session.dailyDate?.let { add(BoardKey(session.gameId, LeaderboardPeriod.DAILY, it)) }
    }

    companion object {
        const val TIER_B_TOP_N = 20
    }
}
