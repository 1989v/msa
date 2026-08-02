package com.kgd.game.application.catalog.port

import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.GameTag
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface GameRepositoryPort {
    fun save(game: Game): Game
    fun findBySlug(slug: String): Game?
    fun findByIds(ids: List<Long>): List<Game>
    fun existsBySlug(slug: String): Boolean

    /** 공개 리스트 — PUBLISHED 만 노출 */
    fun search(tag: String?, genre: Genre?, sort: GameSort, pageable: Pageable): Page<Game>

    /** 태그 교집합 수 기준 유사 게임 (PUBLISHED 만) */
    fun findSimilar(gameId: Long, limit: Int): List<Game>
}

interface GameStatsRepositoryPort {
    fun findByGameId(gameId: Long): GameStats?
    fun findByGameIds(gameIds: List<Long>): List<GameStats>
    fun save(stats: GameStats): GameStats
}

interface GameTagRepositoryPort {
    fun findAll(): List<GameTag>
}

interface GameCollectionRepositoryPort {
    fun findActive(): List<GameCollection>
    fun findBySlug(slug: String): GameCollection?
    fun save(collection: GameCollection): GameCollection
}
