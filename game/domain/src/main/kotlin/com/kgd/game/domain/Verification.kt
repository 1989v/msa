package com.kgd.game.domain

import com.kgd.game.sim.GameModule
import com.kgd.game.sim.SimRunner

/** Tier A 경량 검증 결과. */
data class TierAResult(val accepted: Boolean, val reason: String? = null) {
    companion object {
        val OK = TierAResult(true)
        fun reject(reason: String) = TierAResult(false, reason)
    }
}

/**
 * Tier A — 게임 재실행 없는 경량 타당성 검증(순수 규칙).
 * 토큰/세션-존재/rate-limit 은 인프라(feature)가, 여기선 시간·점수 정합만 본다.
 */
class ScorePlausibility(
    private val minMsPerTick: Long = 30, // tick 당 최소 경과(너무 빠른 클리어 차단)
    private val maxScorePerTick: Int = 1, // Snake: 한 tick 에 최대 한 먹이
) {
    fun verify(session: GameSession, submission: ScoreSubmission, nowEpochMs: Long): TierAResult {
        if (session.status != SessionStatus.OPEN) return TierAResult.reject("session not open")
        if (submission.claimedScore < 0) return TierAResult.reject("negative score")
        val ticks = submission.replay.totalTicks
        if (ticks < 0) return TierAResult.reject("negative ticks")
        if (submission.claimedScore > ticks.toLong() * maxScorePerTick) {
            return TierAResult.reject("score exceeds tick bound")
        }
        val serverElapsed = session.elapsedMs(nowEpochMs)
        if (serverElapsed < ticks.toLong() * minMsPerTick - GRACE_MS) {
            return TierAResult.reject("too fast for ticks")
        }
        if (submission.clientDurationMs > serverElapsed + GRACE_MS) {
            return TierAResult.reject("client duration exceeds server elapsed")
        }
        return TierAResult.OK
    }

    companion object {
        const val GRACE_MS = 2000L
    }
}

/** Tier B 결과. */
data class TierBResult(
    val verified: Boolean,
    val recomputedScore: Int,
    val reason: String? = null,
)

/**
 * Tier B — 보관한 seed+입력 로그로 결정적 코어를 재실행해 점수를 재계산.
 * commerce:app JVM 안에서 game:sim 의 SimRunner 로 도므로 추가 프로세스 0.
 * 점수 위조는 차단하나 '실제로 잘 플레이하는 봇'은 통과 → 이상탐지/검수로 보완(설계 참조).
 */
class ReplayVerifier {
    fun <S> verify(module: GameModule<S>, submission: ScoreSubmission): TierBResult {
        val result = SimRunner.run(module, submission.replay)
        val ok = result.score == submission.claimedScore
        return TierBResult(
            verified = ok,
            recomputedScore = result.score,
            reason = if (ok) null else "score mismatch: claimed=${submission.claimedScore} actual=${result.score}",
        )
    }
}
