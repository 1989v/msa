package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameSaveRepositoryPort
import com.kgd.game.application.play.port.SaveLeasePort
import com.kgd.game.application.play.port.SaveSnapshot
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.play.exception.SaveLockedException
import com.kgd.game.domain.play.exception.SaveTooLargeException
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration

/**
 * 클라우드 세이브 파사드 — 리스(Redis, 외부 IO)는 트랜잭션 밖에서 판정하고,
 * 낙관적 업서트만 트랜잭션 경계(GameSaveCommand) 안에서 수행한다.
 */
@Service
class GameSaveService(
    private val gameRepository: GameRepositoryPort,
    private val saveLease: SaveLeasePort,
    private val saveCommand: GameSaveCommand,
) {
    companion object {
        /** 로드 후 1시간 동안 같은 holder(기기)만 로드/저장 가능 — 멀티기기 동시 조작 방어 */
        private val LEASE_TTL: Duration = Duration.ofHours(1)
        private const val MAX_SAVE_BYTES = 64 * 1024
    }

    fun load(slug: String, memberId: Long, holder: String): SaveSnapshot? {
        val gameId = resolveGameId(slug)
        acquireLeaseOrThrow(gameId, memberId, holder)
        return saveCommand.find(gameId, memberId)
    }

    fun store(slug: String, memberId: Long, holder: String, data: String, expectedVersion: Long): SaveSnapshot {
        val gameId = resolveGameId(slug)
        val size = data.toByteArray(Charsets.UTF_8).size
        if (size > MAX_SAVE_BYTES) throw SaveTooLargeException(size = size, limit = MAX_SAVE_BYTES)
        acquireLeaseOrThrow(gameId, memberId, holder)
        return saveCommand.upsert(gameId, memberId, data, expectedVersion)
    }

    private fun acquireLeaseOrThrow(gameId: Long, memberId: Long, holder: String) {
        if (!saveLease.tryAcquire(gameId, memberId, holder, LEASE_TTL)) throw SaveLockedException()
    }

    private fun resolveGameId(slug: String): Long {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return requireNotNull(game.id) { "영속화된 게임에는 id가 있어야 합니다" }
    }
}

/** 세이브 조회/업서트의 트랜잭션 경계 — 버전 비교와 쓰기가 한 트랜잭션 */
@Component
class GameSaveCommand(
    private val saveRepository: GameSaveRepositoryPort,
) {

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    fun find(gameId: Long, memberId: Long): SaveSnapshot? = saveRepository.find(gameId, memberId)

    @Transactional(transactionManager = "gameTransactionManager")
    fun upsert(gameId: Long, memberId: Long, data: String, expectedVersion: Long): SaveSnapshot =
        saveRepository.upsert(gameId, memberId, data, expectedVersion)
}
