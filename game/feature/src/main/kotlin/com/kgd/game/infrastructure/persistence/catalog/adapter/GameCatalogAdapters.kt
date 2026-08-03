package com.kgd.game.infrastructure.persistence.catalog.adapter

import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.catalog.port.GameTagRepositoryPort
import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.GameTag
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.infrastructure.persistence.catalog.entity.GameCollectionJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameStatsJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameTagMapJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.repository.GameCollectionJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameQueryRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameStatsJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameTagJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameTagMapJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository

@Repository
class GameRepositoryAdapter(
    private val jpaRepository: GameJpaRepository,
    private val queryRepository: GameQueryRepository,
    private val tagMapRepository: GameTagMapJpaRepository,
) : GameRepositoryPort {

    override fun save(game: Game): Game {
        val id = game.id
        val entity = if (id != null) {
            val existing = jpaRepository.findById(id).orElseThrow()
            existing.update(game)
            existing
        } else {
            jpaRepository.save(GameJpaEntity.fromDomain(game))
        }
        syncTagMap(requireNotNull(entity.id), game.tags)
        return entity.toDomain()
    }

    override fun findBySlug(slug: String): Game? = jpaRepository.findBySlug(slug)?.toDomain()

    override fun findByIds(ids: List<Long>): List<Game> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllById(ids).map { it.toDomain() }

    override fun existsBySlug(slug: String): Boolean = jpaRepository.existsBySlug(slug)

    override fun search(tag: String?, genre: Genre?, sort: GameSort, pageable: Pageable): Page<Game> =
        queryRepository.search(tag, genre, sort, pageable).map { it.toDomain() }

    override fun findSimilar(gameId: Long, limit: Int): List<Game> =
        queryRepository.findSimilar(gameId, limit).map { it.toDomain() }

    /** Game.tags(json 스냅샷) → game_tag_map(조회용 정규화 뷰) 동기화 */
    private fun syncTagMap(gameId: Long, tags: List<String>) {
        tagMapRepository.deleteAllByGameId(gameId)
        if (tags.isNotEmpty()) {
            tagMapRepository.saveAll(tags.map { GameTagMapJpaEntity(gameId = gameId, tagSlug = it) })
        }
    }
}

@Repository
class GameStatsRepositoryAdapter(
    private val jpaRepository: GameStatsJpaRepository,
) : GameStatsRepositoryPort {

    override fun findByGameId(gameId: Long): GameStats? =
        jpaRepository.findById(gameId).orElse(null)?.toDomain()

    override fun findByGameIds(gameIds: List<Long>): List<GameStats> =
        if (gameIds.isEmpty()) emptyList() else jpaRepository.findAllById(gameIds).map { it.toDomain() }

    override fun save(stats: GameStats): GameStats {
        val existing = jpaRepository.findById(stats.gameId).orElse(null)
        val entity = if (existing != null) {
            existing.update(stats)
            existing
        } else {
            jpaRepository.save(GameStatsJpaEntity.fromDomain(stats))
        }
        return entity.toDomain()
    }
}

@Repository
class GameTagRepositoryAdapter(
    private val jpaRepository: GameTagJpaRepository,
) : GameTagRepositoryPort {

    override fun findAll(): List<GameTag> = jpaRepository.findAllByOrderByDisplayOrderAsc().map { it.toDomain() }
}

@Repository
class GameCollectionRepositoryAdapter(
    private val jpaRepository: GameCollectionJpaRepository,
) : GameCollectionRepositoryPort {

    override fun findActive(): List<GameCollection> =
        jpaRepository.findByActiveTrueOrderByDisplayOrderAsc().map { it.toDomain() }

    override fun findBySlug(slug: String): GameCollection? = jpaRepository.findBySlug(slug)?.toDomain()

    override fun save(collection: GameCollection): GameCollection {
        val id = collection.id
        val entity = if (id != null) {
            val existing = jpaRepository.findById(id).orElseThrow()
            existing.update(collection)
            existing
        } else {
            jpaRepository.save(GameCollectionJpaEntity.fromDomain(collection))
        }
        return entity.toDomain()
    }
}
