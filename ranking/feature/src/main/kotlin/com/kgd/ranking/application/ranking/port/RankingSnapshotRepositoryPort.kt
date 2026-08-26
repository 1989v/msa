package com.kgd.ranking.application.ranking.port

import com.kgd.ranking.domain.model.RankingSnapshot
import java.time.Instant

interface RankingSnapshotRepositoryPort {
    fun save(snapshot: RankingSnapshot): RankingSnapshot
    fun findById(id: Long): RankingSnapshot?
    fun findIdsCapturedBefore(threshold: Instant): List<Long>
    fun deleteAllById(ids: Collection<Long>)
}
