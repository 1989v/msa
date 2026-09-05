package com.kgd.game.infrastructure.persistence.access.adapter

import com.kgd.game.application.access.port.PrivateGameAccessRepositoryPort
import com.kgd.game.domain.access.model.PrivateGameAccess
import com.kgd.game.infrastructure.persistence.access.entity.PrivateGameAccessJpaEntity
import com.kgd.game.infrastructure.persistence.access.repository.PrivateGameAccessJpaRepository
import org.springframework.stereotype.Component

@Component
class PrivateGameAccessAdapter(
    private val jpaRepository: PrivateGameAccessJpaRepository,
) : PrivateGameAccessRepositoryPort {

    override fun exists(gameSlug: String, memberId: Long): Boolean =
        jpaRepository.existsByGameSlugAndMemberId(gameSlug, memberId)

    override fun findAll(gameSlug: String): List<PrivateGameAccess> =
        jpaRepository.findByGameSlugOrderByCreatedAtAsc(gameSlug).map { it.toDomain() }

    override fun save(access: PrivateGameAccess): PrivateGameAccess {
        // 이미 허용된 사람을 다시 넣으면 유일 제약에 걸린다 — 같은 뜻이므로 있던 행을 돌려준다
        val existing = jpaRepository.findByGameSlugOrderByCreatedAtAsc(access.gameSlug)
            .firstOrNull { it.memberId == access.memberId }
        if (existing != null) {
            existing.note = access.note ?: existing.note
            return existing.toDomain()
        }
        return jpaRepository.save(PrivateGameAccessJpaEntity.from(access)).toDomain()
    }

    override fun delete(gameSlug: String, memberId: Long): Boolean =
        jpaRepository.deleteByGameSlugAndMemberId(gameSlug, memberId) > 0
}
