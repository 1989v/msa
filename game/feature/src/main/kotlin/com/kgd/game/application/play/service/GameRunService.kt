package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameRunRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.play.exception.RunNotFoundException
import com.kgd.game.domain.play.model.GameRun
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant
import java.util.UUID

/**
 * 로그라이크 런 — 서버가 시드를 발급/보관하므로 클라이언트는 시드를 고를 수 없고,
 * 같은 runKey 재로드는 항상 같은 시드다 (세이브스커밍 무의미화). 사망/클리어 시 consume.
 */
@Service
@Transactional(transactionManager = "gameTransactionManager")
class GameRunService(
    private val gameRepository: GameRepositoryPort,
    private val runRepository: GameRunRepositoryPort,
) {
    private val random = SecureRandom()

    fun start(slug: String, memberId: Long?): GameRun {
        val gameId = resolveGameId(slug)
        return runRepository.save(
            GameRun.start(
                runKey = UUID.randomUUID().toString(),
                gameId = gameId,
                memberId = memberId,
                seed = random.nextLong(),
                now = Instant.now(),
            )
        )
    }

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    fun get(slug: String, runKey: String): GameRun = findRunOf(slug, runKey)

    fun consume(slug: String, runKey: String, outcome: String?): GameRun {
        val run = findRunOf(slug, runKey)
        run.consume(outcome = outcome, now = Instant.now())
        return runRepository.save(run)
    }

    private fun findRunOf(slug: String, runKey: String): GameRun {
        val gameId = resolveGameId(slug)
        val run = runRepository.findByRunKey(runKey) ?: throw RunNotFoundException(runKey)
        if (run.gameId != gameId) throw RunNotFoundException(runKey)
        return run
    }

    private fun resolveGameId(slug: String): Long {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return requireNotNull(game.id) { "영속화된 게임에는 id가 있어야 합니다" }
    }
}
