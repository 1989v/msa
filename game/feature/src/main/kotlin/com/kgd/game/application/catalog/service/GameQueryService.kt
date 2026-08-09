package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.GameCollectionDto
import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.dto.GameSummaryDto
import com.kgd.game.application.catalog.dto.GameTagDto
import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.catalog.port.GameTagRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class GameQueryService(
    private val gameRepository: GameRepositoryPort,
    private val statsRepository: GameStatsRepositoryPort,
    private val tagRepository: GameTagRepositoryPort,
    private val collectionRepository: GameCollectionRepositoryPort,
) {
    companion object {
        private const val COLLECTION_SIZE = 10
        private const val SIMILAR_LIMIT = 8
    }

    fun list(tag: String?, genre: Genre?, sort: GameSort, page: Int, size: Int): Page<GameSummaryDto> {
        val games = gameRepository.search(tag, genre, sort, PageRequest.of(page, size))
        val statsByGameId = statsOf(games.content)
        return games.map { GameSummaryDto.of(it, statsByGameId[it.id]) }
    }

    fun detail(slug: String): GameDetailDto {
        val game = findVisibleGame(slug)
        val gameId = game.id
        return GameDetailDto.of(game, gameId?.let { statsRepository.findByGameId(it) })
    }

    fun similar(slug: String): List<GameSummaryDto> {
        val game = findVisibleGame(slug)
        val gameId = game.id ?: return emptyList()
        val similar = gameRepository.findSimilar(gameId, SIMILAR_LIMIT)
        val statsByGameId = statsOf(similar)
        return similar.map { GameSummaryDto.of(it, statsByGameId[it.id]) }
    }

    fun tags(): List<GameTagDto> = tagRepository.findAll().map { GameTagDto.of(it) }

    fun collections(): List<GameCollectionDto> =
        collectionRepository.findActive().map { collection ->
            val games = when (collection.type) {
                CollectionType.MANUAL -> pickedGames(collection.gameIds)
                CollectionType.TRENDING -> pinnedThen(collection.gameIds, pageOf(sort = GameSort.TRENDING))
                CollectionType.NEW -> pinnedThen(collection.gameIds, pageOf(sort = GameSort.NEW))
                CollectionType.TAG_BASED ->
                    pinnedThen(collection.gameIds, pageOf(sort = GameSort.TRENDING, tag = collection.tagSlug))
            }
            val statsByGameId = statsOf(games)
            GameCollectionDto(
                slug = collection.slug,
                title = collection.title,
                type = collection.type,
                games = games.map { GameSummaryDto.of(it, statsByGameId[it.id]) },
            )
        }

    private fun pageOf(sort: GameSort, tag: String? = null): List<Game> =
        gameRepository.search(tag, null, sort, PageRequest.of(0, COLLECTION_SIZE)).content

    /**
     * 어드민이 고른 순서 그대로. `findByIds` 는 상태를 거르지 않으므로 여기서 공개 가능 여부를 확인한다 —
     * 확인하지 않으면 DRAFT/SUSPENDED 게임이 공개 컬렉션에 실린다.
     */
    private fun pickedGames(gameIds: List<Long>): List<Game> {
        if (gameIds.isEmpty()) return emptyList()
        val byId = gameRepository.findByIds(gameIds).filter { it.isPlayable() }.associateBy { it.id }
        return gameIds.mapNotNull { byId[it] }
    }

    /**
     * 자동 산출 컬렉션(인기/신규/태그)에서 `gameIds` 는 **맨 앞에 고정할 게임** 목록으로 쓴다.
     * 순위는 통계가 정하되 운영자가 특정 게임을 앞세울 수 있어야 해서, 컬럼을 새로 만들지 않고
     * MANUAL 이 쓰던 자리를 이 의미로 재사용한다.
     */
    private fun pinnedThen(pinnedIds: List<Long>, computed: List<Game>): List<Game> {
        if (pinnedIds.isEmpty()) return computed
        val pinned = pickedGames(pinnedIds)
        val pinnedSet = pinned.mapNotNull { it.id }.toSet()
        return (pinned + computed.filterNot { it.id in pinnedSet }).take(COLLECTION_SIZE)
    }

    /** DRAFT/REVIEW/SUSPENDED 는 존재 여부 은닉 — NOT_FOUND */
    private fun findVisibleGame(slug: String): Game {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return game
    }

    private fun statsOf(games: List<Game>) =
        statsRepository.findByGameIds(games.mapNotNull { it.id }).associateBy { it.gameId }
}
