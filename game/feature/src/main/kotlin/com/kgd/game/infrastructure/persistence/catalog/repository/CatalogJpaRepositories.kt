package com.kgd.game.infrastructure.persistence.catalog.repository

import com.kgd.game.infrastructure.persistence.catalog.entity.GameCollectionJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameStatsJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameTagJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameTagMapJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface GameJpaRepository : JpaRepository<GameJpaEntity, Long> {
    fun findBySlug(slug: String): GameJpaEntity?
    fun existsBySlug(slug: String): Boolean
}

interface GameTagJpaRepository : JpaRepository<GameTagJpaEntity, Long> {
    fun findAllByOrderByDisplayOrderAsc(): List<GameTagJpaEntity>
}

interface GameTagMapJpaRepository : JpaRepository<GameTagMapJpaEntity, Long> {
    fun deleteByGameId(gameId: Long)
}

interface GameStatsJpaRepository : JpaRepository<GameStatsJpaEntity, Long>

interface GameCollectionJpaRepository : JpaRepository<GameCollectionJpaEntity, Long> {
    fun findBySlug(slug: String): GameCollectionJpaEntity?
    fun findByActiveTrueOrderByDisplayOrderAsc(): List<GameCollectionJpaEntity>
}
