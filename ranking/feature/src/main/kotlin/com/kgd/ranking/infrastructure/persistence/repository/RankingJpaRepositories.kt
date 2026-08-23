package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.GasStationPriceJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingBoardJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingEntryJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingSnapshotJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
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

    /**
     * 좌표 사각형(bounding box) 안의 주유소.
     *
     * 경로 탐색이 샘플 포인트마다 부르는 질의라 원형 거리 계산을 SQL 에서 하지 않는다 —
     * 인덱스를 못 타서 전체 스캔이 된다. 사각형으로 좁힌 뒤 정확한 거리는 애플리케이션이 잰다.
     */
    @Query(
        """
        SELECT s FROM GasStationJpaEntity s
        WHERE s.latitude BETWEEN :minLat AND :maxLat
          AND s.longitude BETWEEN :minLng AND :maxLng
        """,
    )
    fun findWithinBox(
        @Param("minLat") minLat: java.math.BigDecimal,
        @Param("maxLat") maxLat: java.math.BigDecimal,
        @Param("minLng") minLng: java.math.BigDecimal,
        @Param("maxLng") maxLng: java.math.BigDecimal,
    ): List<GasStationJpaEntity>
}

interface GasStationPriceJpaRepository : JpaRepository<GasStationPriceJpaEntity, Long> {
    fun findByStationIdAndProductCode(stationId: Long, productCode: String): GasStationPriceJpaEntity?
    fun findByStationIdIn(stationIds: Collection<Long>): List<GasStationPriceJpaEntity>
    fun findByStationIdInAndProductCode(stationIds: Collection<Long>, productCode: String): List<GasStationPriceJpaEntity>
}
