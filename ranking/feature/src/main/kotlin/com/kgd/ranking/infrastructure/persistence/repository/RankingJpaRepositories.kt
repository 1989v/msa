package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.GasStationPriceJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingBoardJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingEntryJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingSnapshotJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface RankingBoardJpaRepository : JpaRepository<RankingBoardJpaEntity, Long> {
    fun findBySlug(slug: String): RankingBoardJpaEntity?
    fun findByDomainAndScopeKey(domain: RankingDomain, scopeKey: String): List<RankingBoardJpaEntity>
    fun findByStatusOrderByScopeKeyAsc(status: com.kgd.ranking.domain.model.BoardStatus): List<RankingBoardJpaEntity>
}

interface RankingSnapshotJpaRepository : JpaRepository<RankingSnapshotJpaEntity, Long> {
    fun findFirstByBoardIdOrderByCapturedAtDesc(boardId: Long): RankingSnapshotJpaEntity?
    fun deleteByBoardIdAndCapturedAtBefore(boardId: Long, threshold: Instant): Int
}

interface RankingEntryJpaRepository : JpaRepository<RankingEntryJpaEntity, Long> {
    fun findBySnapshotIdOrderByRankNoAsc(snapshotId: Long, pageable: Pageable): List<RankingEntryJpaEntity>
    fun findBySnapshotIdOrderByRankNoAsc(snapshotId: Long): List<RankingEntryJpaEntity>
    fun countBySnapshotId(snapshotId: Long): Long
    fun deleteBySnapshotIdIn(snapshotIds: Collection<Long>): Int
}

interface GasStationJpaRepository : JpaRepository<GasStationJpaEntity, Long> {
    fun findByOpinetId(opinetId: String): GasStationJpaEntity?
    fun findByOpinetIdIn(opinetIds: Collection<String>): List<GasStationJpaEntity>
    fun findByAreaCode(areaCode: String): List<GasStationJpaEntity>

}

interface GasStationPriceJpaRepository : JpaRepository<GasStationPriceJpaEntity, Long> {
    fun findByStationIdAndProductCode(stationId: Long, productCode: String): GasStationPriceJpaEntity?
    fun findByStationIdIn(stationIds: Collection<Long>): List<GasStationPriceJpaEntity>
    fun findByStationIdInAndProductCode(stationIds: Collection<Long>, productCode: String): List<GasStationPriceJpaEntity>
}
