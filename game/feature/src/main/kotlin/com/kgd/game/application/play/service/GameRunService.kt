package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameRunRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.play.exception.RunNotFoundException
import com.kgd.game.domain.play.model.GameRun
import com.kgd.game.application.play.usecase.ConsumeGameRunUseCase
import com.kgd.game.application.play.usecase.GetGameRunUseCase
import com.kgd.game.application.play.usecase.StartGameRunUseCase
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
) : StartGameRunUseCase, GetGameRunUseCase, ConsumeGameRunUseCase {
    private val random = SecureRandom()

    override fun execute(command: StartGameRunUseCase.Command): GameRun {
        val gameId = resolveGameId(command.slug)
        return runRepository.save(
            GameRun.start(
                runKey = UUID.randomUUID().toString(),
                gameId = gameId,
                memberId = command.memberId,
                seed = random.nextLong(),
                now = Instant.now(),
            )
        )
    }

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(query: GetGameRunUseCase.Query): GameRun = findRunOf(query.slug, query.runKey)

    override fun execute(command: ConsumeGameRunUseCase.Command): GameRun {
        val run = findRunOf(command.slug, command.runKey)
        run.consume(outcome = command.outcome, now = Instant.now())
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
