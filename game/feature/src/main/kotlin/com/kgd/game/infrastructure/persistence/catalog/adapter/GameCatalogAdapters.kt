package com.kgd.game.infrastructure.persistence.catalog.adapter

import com.kgd.game.application.catalog.dto.AdminGameSummaryDto
import com.kgd.game.application.catalog.port.GameAdminQueryPort
import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.catalog.port.GameTagRepositoryPort
import com.kgd.game.application.catalog.dto.GameSort
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.GameStatus
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
import java.time.ZoneId

@Repository
class GameRepositoryAdapter(
    private val jpaRepository: GameJpaRepository,
    private val queryRepository: GameQueryRepository,
    private val tagMapRepository: GameTagMapJpaRepository,
) : GameRepositoryPort {

    companion object {
        /**
         * 공개 리스트 불변식 — 플레이 가능한 상태(PUBLISHED, BETA)만 공개 목록에 실린다.
         * DRAFT/REVIEW/SUSPENDED 는 어떤 경로로도 실리지 않는다.
         * BETA 를 포함하는 이유: 피드백을 받으려면 찾을 수 있어야 한다. 대신 FE 가 배지로 구분하고,
         * 수익화는 `Game.isMonetizable()`(PUBLISHED 전용)이 따로 막는다.
         */
        private val PUBLIC_STATUSES = setOf(GameStatus.PUBLISHED, GameStatus.BETA)
    }

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
        queryRepository
            .search(GameSearchCriteria(tag = tag, genre = genre, statuses = PUBLIC_STATUSES, sort = sort), pageable)
            .map { it.toDomain() }

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
class GameAdminQueryAdapter(
    private val queryRepository: GameQueryRepository,
    private val statsJpaRepository: GameStatsJpaRepository,
) : GameAdminQueryPort {

    override fun search(criteria: GameSearchCriteria, pageable: Pageable): Page<AdminGameSummaryDto> {
        val page = queryRepository.search(criteria, pageable)
        val statsByGameId = statsJpaRepository
            .findAllById(page.content.mapNotNull { it.id })
            .associateBy { it.gameId }
        return page.map { entity -> entity.toAdminSummary(statsByGameId[entity.id]?.toDomain()) }
    }

    private fun GameJpaEntity.toAdminSummary(stats: GameStats?) = AdminGameSummaryDto(
        id = id ?: 0,
        slug = slug,
        title = title,
        titleEn = titleEn,
        thumbnailUrl = thumbnailUrl,
        status = status,
        genre = genre,
        tags = tags,
        playCount = stats?.playCount ?: 0,
        ratingAvg = stats?.averageRating() ?: 0.0,
        ratingCount = stats?.ratingCount ?: 0,
        // @UpdateTimestamp 이 JVM 기본 존으로 찍으므로 같은 존으로 되돌린다
        updatedAt = updatedAt.atZone(ZoneId.systemDefault()).toInstant(),
    )
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

    override fun findAll(): List<GameCollection> =
        jpaRepository.findAllByOrderByDisplayOrderAsc().map { it.toDomain() }

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
