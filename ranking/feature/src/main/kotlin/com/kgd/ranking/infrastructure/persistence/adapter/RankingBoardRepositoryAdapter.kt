package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.ranking.port.RankingBoardRepositoryPort
import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.infrastructure.persistence.entity.RankingBoardJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.RankingBoardJpaRepository
import org.springframework.stereotype.Component

@Component
class RankingBoardRepositoryAdapter(
    private val jpaRepository: RankingBoardJpaRepository,
) : RankingBoardRepositoryPort {

    override fun findBySlug(slug: String): RankingBoard? = jpaRepository.findBySlug(slug)?.toDomain()

    override fun findByDomainAndScopeKey(domain: RankingDomain, scopeKey: String): List<RankingBoard> =
        jpaRepository.findByDomainAndScopeKey(domain, scopeKey).map { it.toDomain() }

    override fun findByStatus(status: BoardStatus): List<RankingBoard> =
        jpaRepository.findByStatusOrderByScopeKeyAsc(status).map { it.toDomain() }

    override fun save(board: RankingBoard): RankingBoard {
        val id = board.id
        val managed = id?.let { jpaRepository.findById(it).orElse(null) }
        if (managed != null) {
            managed.applyFrom(board)
            return managed.toDomain()
        }
        return jpaRepository.save(RankingBoardJpaEntity.fromDomain(board)).toDomain()
    }
}
