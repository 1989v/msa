package com.kgd.game.infrastructure.persistence.access.repository

import com.kgd.game.infrastructure.persistence.access.entity.PrivateGameAccessJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface PrivateGameAccessJpaRepository : JpaRepository<PrivateGameAccessJpaEntity, Long> {
    fun existsByGameSlugAndMemberId(gameSlug: String, memberId: Long): Boolean

    fun findByGameSlugOrderByCreatedAtAsc(gameSlug: String): List<PrivateGameAccessJpaEntity>

    fun deleteByGameSlugAndMemberId(gameSlug: String, memberId: Long): Long
}
