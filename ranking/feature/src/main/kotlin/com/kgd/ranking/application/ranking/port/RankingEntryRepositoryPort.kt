package com.kgd.ranking.application.ranking.port

import com.kgd.ranking.domain.model.RankingEntry

interface RankingEntryRepositoryPort {
    /** 순위 오름차순 */
    fun findBySnapshotId(snapshotId: Long): List<RankingEntry>
    fun countBySnapshotId(snapshotId: Long): Int
    fun saveAll(snapshotId: Long, entries: List<RankingEntry>)
    fun deleteBySnapshotIdIn(snapshotIds: Collection<Long>)
}
