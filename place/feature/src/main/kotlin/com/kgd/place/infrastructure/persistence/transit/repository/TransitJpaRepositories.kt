package com.kgd.place.infrastructure.persistence.transit.repository

import com.kgd.place.infrastructure.persistence.transit.entity.TransitBusCoverageJpaEntity
import com.kgd.place.infrastructure.persistence.transit.entity.TransitBusStopJpaEntity
import com.kgd.place.infrastructure.persistence.transit.entity.TransitRailStationJpaEntity
import com.kgd.place.infrastructure.persistence.transit.entity.TransitSourceRunJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

// 지우기는 전부 벌크 DELETE 다 — 바로 실행되어, 같은 트랜잭션에서 같은 자연 키를 다시 넣어도 유니크 키에 걸리지 않는다.

interface TransitRailStationJpaRepository : JpaRepository<TransitRailStationJpaEntity, Long> {
    @Modifying
    @Query("DELETE FROM TransitRailStationJpaEntity r WHERE r.loadRunId = :runId AND r.sourceKey IN :keys")
    fun deleteByRunAndKeys(@Param("runId") runId: String, @Param("keys") keys: Collection<String>): Int

    @Modifying
    @Query("DELETE FROM TransitRailStationJpaEntity r WHERE r.loadRunId <> :runId")
    fun deleteOtherRuns(@Param("runId") runId: String): Int

    fun countByLoadRunId(loadRunId: String): Long
}

interface TransitBusStopJpaRepository : JpaRepository<TransitBusStopJpaEntity, Long> {
    @Modifying
    @Query("DELETE FROM TransitBusStopJpaEntity b WHERE b.loadRunId = :runId AND b.sourceKey IN :keys")
    fun deleteByRunAndKeys(@Param("runId") runId: String, @Param("keys") keys: Collection<String>): Int

    @Modifying
    @Query("DELETE FROM TransitBusStopJpaEntity b WHERE b.loadRunId <> :runId")
    fun deleteOtherRuns(@Param("runId") runId: String): Int

    fun countByLoadRunId(loadRunId: String): Long
}

interface TransitSourceRunJpaRepository : JpaRepository<TransitSourceRunJpaEntity, String>

interface TransitBusCoverageJpaRepository : JpaRepository<TransitBusCoverageJpaEntity, String> {
    @Modifying
    @Query("DELETE FROM TransitBusCoverageJpaEntity c")
    fun deleteAllRows(): Int
}
