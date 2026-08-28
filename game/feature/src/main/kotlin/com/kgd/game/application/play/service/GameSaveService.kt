package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameSaveRepositoryPort
import com.kgd.game.application.play.port.SaveSnapshot
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.play.exception.SaveTooLargeException
import org.springframework.stereotype.Component
import com.kgd.game.application.play.usecase.LoadGameSaveUseCase
import com.kgd.game.application.play.usecase.StoreGameSaveUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 클라우드 세이브 파사드 — 게임 해석과 크기 상한을 보고 트랜잭션 경계(GameSaveCommand)로 넘긴다.
 *
 * 동시 쓰기 방어는 `@Version` 낙관적 락 하나가 맡는다. 전에는 그 위에 Redis 디바이스 리스가
 * 한 겹 더 있었는데, 그것이 실제로 재던 것은 "동시"가 아니라 "1시간 안의 다른 기기"라
 * 폰에서 PC 로 옮긴 사람까지 막았다. 게다가 실패가 클라이언트에서 조용히 삼켜져
 * 낙관적 락 거부와 화면상 구분되지 않았다. 기기 간 어긋남은 클라이언트가 마지막으로 맞춘
 * version 을 들고 서버가 앞서면 서버본을 받는 쪽으로 푼다 — 막는 대신 맞춘다.
 */
@Service
class GameSaveService(
    private val gameRepository: GameRepositoryPort,
    private val saveCommand: GameSaveCommand,
) : LoadGameSaveUseCase, StoreGameSaveUseCase {
    companion object {
        private const val MAX_SAVE_BYTES = 64 * 1024
    }

    /** 로그인 사용자는 memberId 로, 게스트는 이어하기 코드로 자기 세이브를 찾는다. 신원이 없으면 null */
    override fun execute(query: LoadGameSaveUseCase.Query): SaveSnapshot? {
        val (slug, memberId, code) = query
        val gameId = resolveGameId(slug)
        memberId?.let { saveCommand.find(gameId, it) }?.let { return it }
        // 계정 슬롯이 아직 비었으면 손에 든 코드로 폴백한다. 게스트로 쌓은 진행도가 로그인
        // 직후에 사라진 것처럼 보이지 않게 하려는 것이고, 저장 때 되돌려 보낼 version 도
        // 여기서 받아야 승계가 버전 충돌 없이 이어진다.
        return code?.takeIf { it.isNotBlank() }?.let { saveCommand.findByCode(gameId, it) }
    }

    override fun execute(command: StoreGameSaveUseCase.Command): SaveSnapshot {
        val (slug, memberId, code, data, expectedVersion) = command
        val gameId = resolveGameId(slug)
        val size = data.toByteArray(Charsets.UTF_8).size
        if (size > MAX_SAVE_BYTES) throw SaveTooLargeException(size = size, limit = MAX_SAVE_BYTES)
        return saveCommand.upsert(gameId, memberId, code, data, expectedVersion)
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
