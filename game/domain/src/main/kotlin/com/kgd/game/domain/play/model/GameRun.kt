package com.kgd.game.domain.play.model

import com.kgd.game.domain.play.exception.RunAlreadyConsumedException
import java.time.Instant

enum class RunStatus { ACTIVE, CONSUMED }

/**
 * 로그라이크 런 — 서버 권위 시드 (설계: 세이브스커밍 방어).
 * 같은 runKey 로드는 항상 같은 seed 라 재로드해도 난수가 바뀌지 않고,
 * 사망/클리어 시 consume 되면 재시작만 가능하다.
 */
class GameRun private constructor(
    val id: Long? = null,
    val runKey: String,
    val gameId: Long,
    val memberId: Long?,
    val seed: Long,
    var status: RunStatus,
    var outcome: String?,
    val createdAt: Instant,
    var consumedAt: Instant?
) {
    companion object {
        private const val MAX_OUTCOME_LENGTH = 32

        fun start(runKey: String, gameId: Long, memberId: Long?, seed: Long, now: Instant): GameRun {
            require(runKey.isNotBlank()) { "runKey는 비어있을 수 없습니다" }
            return GameRun(
                runKey = runKey,
                gameId = gameId,
                memberId = memberId,
                seed = seed,
                status = RunStatus.ACTIVE,
                outcome = null,
                createdAt = now,
                consumedAt = null
            )
        }

        fun restore(
            id: Long?,
            runKey: String,
            gameId: Long,
            memberId: Long?,
            seed: Long,
            status: RunStatus,
            outcome: String?,
            createdAt: Instant,
            consumedAt: Instant?
        ): GameRun = GameRun(id, runKey, gameId, memberId, seed, status, outcome, createdAt, consumedAt)
    }

    fun consume(outcome: String?, now: Instant) {
        if (status != RunStatus.ACTIVE) throw RunAlreadyConsumedException(runKey)
        status = RunStatus.CONSUMED
        this.outcome = outcome?.take(MAX_OUTCOME_LENGTH)
        consumedAt = now
    }

    fun isActive(): Boolean = status == RunStatus.ACTIVE
}
