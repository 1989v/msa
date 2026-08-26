package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.ranking.port.RankingSnapshotRepositoryPort
import com.kgd.ranking.domain.model.RankingSnapshot
import com.kgd.ranking.infrastructure.persistence.entity.RankingSnapshotJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.RankingSnapshotJpaRepository
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class RankingSnapshotRepositoryAdapter(
    private val jpaRepository: RankingSnapshotJpaRepository,
) : RankingSnapshotRepositoryPort {

    override fun save(snapshot: RankingSnapshot): RankingSnapshot =
        jpaRepository.save(RankingSnapshotJpaEntity.fromDomain(snapshot)).toDomain()

    override fun findById(id: Long): RankingSnapshot? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findIdsCapturedBefore(threshold: Instant): List<Long> =
        jpaRepository.findByCapturedAtBefore(threshold).mapNotNull { it.id }

    override fun deleteAllById(ids: Collection<Long>) = jpaRepository.deleteAllById(ids)
}
