package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionAccessJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionAccessJpaRepository : JpaRepository<AttractionAccessJpaEntity, Long> {

    /** 벌크 DELETE — 바로 실행되어 같은 트랜잭션에서 같은 (관광지, 종류, 순위)를 다시 넣어도 유니크 키에 걸리지 않는다. */
    @Modifying
    @Query("DELETE FROM AttractionAccessJpaEntity a WHERE a.attractionId IN :ids")
    fun deleteByAttractionIds(@Param("ids") ids: Collection<Long>): Int

    @Modifying
    @Query("DELETE FROM AttractionAccessJpaEntity a WHERE a.computedAt < :computedAt")
    fun deleteComputedBefore(@Param("computedAt") computedAt: LocalDateTime): Int

    fun findByAttractionIdIn(ids: Collection<Long>): List<AttractionAccessJpaEntity>

    /**
     * 관광지 시군구(법정동 시도+시군구) → 버스 원천 연계 판정. 판정이 없는 시군구의 관광지는 빠진다.
     * 콜레이션을 명시한다 — 운영 place_db 기본값(utf8mb4_unicode_ci)으로 만든 V35 표와 attractions(utf8mb4_0900_ai_ci)를
     * 그대로 비교하면 「Illegal mix of collations」로 조회 전체가 실패한다.
     */
    @Query(
        value = """
            SELECT a.id AS attractionId, c.covered AS covered
            FROM attractions a
            JOIN transit_bus_coverage c ON c.sigungu_code = CONCAT(a.ldong_regn_cd, a.ldong_signgu_cd) COLLATE utf8mb4_unicode_ci
            WHERE a.id IN (:ids)
        """,
        nativeQuery = true,
    )
    fun findBusCoverage(@Param("ids") ids: Collection<Long>): List<BusCoverageRow>

    interface BusCoverageRow {
        fun getAttractionId(): Long
        fun getCovered(): Boolean
    }
}
