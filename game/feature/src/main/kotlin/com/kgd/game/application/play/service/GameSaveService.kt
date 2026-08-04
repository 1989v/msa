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
/** 저장 후 1시간 동안 같은 holder(기기)만 저장 가능 — 멀티기기 동시 쓰기 방어 */
        private val LEASE_TTL: Duration = Duration.ofHours(1)
        private const val MAX_SAVE_BYTES = 64 * 1024
    }

    /**
     * 로그인 사용자는 memberId 로, 게스트는 이어하기 코드로 자기 세이브를 찾는다.
     * 읽기는 잠그지 않는다 — 브라우저를 잃고 코드로 복구하는 경로가 이전 기기의 리스에 막히면 안 된다.
     */
    fun load(slug: String, memberId: Long?, code: String?, holder: String): SaveSnapshot? {
        val gameId = resolveGameId(slug)
        subjectOf(memberId, code) ?: return null                    // 신원이 없으면 불러올 세이브도 없다
        return if (memberId != null) saveCommand.find(gameId, memberId)
        else saveCommand.findByCode(gameId, requireNotNull(code))
    }

    fun store(
        slug: String,
        memberId: Long?,
        code: String?,
        holder: String,
        data: String,
        expectedVersion: Long,
    ): SaveSnapshot {
        val gameId = resolveGameId(slug)
        val size = data.toByteArray(Charsets.UTF_8).size
        if (size > MAX_SAVE_BYTES) throw SaveTooLargeException(size = size, limit = MAX_SAVE_BYTES)
        // 코드가 아직 없는 첫 저장은 잠글 대상이 없다 — 발급 후부터 리스가 걸린다.
        // 코드로 식별된 요청은 코드 자체가 자격 증명이라 이전 기기의 리스를 넘겨받는다.
        subjectOf(memberId, code)?.let { acquireLeaseOrThrow(gameId, it, holder, takeover = memberId == null) }
        return saveCommand.upsert(gameId, memberId, code, data, expectedVersion)
    }

    private fun subjectOf(memberId: Long?, code: String?): String? =
        memberId?.toString() ?: code?.takeIf { it.isNotBlank() }?.uppercase()

    private fun acquireLeaseOrThrow(gameId: Long, subject: String, holder: String, takeover: Boolean = false) {
        if (!saveLease.tryAcquire(gameId, subject, holder, LEASE_TTL, takeover)) throw SaveLockedException()
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

    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    fun findByCode(gameId: Long, code: String): SaveSnapshot? = saveRepository.findByCode(gameId, code)

    @Transactional(transactionManager = "gameTransactionManager")
    fun upsert(gameId: Long, memberId: Long?, code: String?, data: String, expectedVersion: Long): SaveSnapshot =
        saveRepository.upsert(gameId, memberId, code, data, expectedVersion)
}
