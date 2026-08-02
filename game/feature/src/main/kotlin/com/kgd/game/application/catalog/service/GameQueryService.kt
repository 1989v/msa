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
                CollectionType.MANUAL -> {
                    val byId = gameRepository.findByIds(collection.gameIds).associateBy { it.id }
                    collection.gameIds.mapNotNull { byId[it] }
                }
                CollectionType.TRENDING -> pageOf(sort = GameSort.TRENDING)
                CollectionType.NEW -> pageOf(sort = GameSort.NEW)
                CollectionType.TAG_BASED -> pageOf(sort = GameSort.TRENDING, tag = collection.tagSlug)
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

    /** DRAFT/REVIEW/SUSPENDED 는 존재 여부 은닉 — NOT_FOUND */
    private fun findVisibleGame(slug: String): Game {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return game
    }

    private fun statsOf(games: List<Game>) =
        statsRepository.findByGameIds(games.mapNotNull { it.id }).associateBy { it.gameId }
}
