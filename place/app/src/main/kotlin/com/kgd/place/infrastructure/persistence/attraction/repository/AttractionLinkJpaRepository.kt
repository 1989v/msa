package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.domain.attraction.model.AttractionLinkSource
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionLinkJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionLinkRequestJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionLinkJpaRepository : JpaRepository<AttractionLinkJpaEntity, Long> {
    fun findByAttractionIdOrderBySourceAscSortOrderAsc(attractionId: Long): List<AttractionLinkJpaEntity>

    fun deleteByAttractionIdAndSource(attractionId: Long, source: AttractionLinkSource)
}

interface AttractionLinkRequestJpaRepository : JpaRepository<AttractionLinkRequestJpaEntity, Long> {
    fun findByAttractionIdAndSource(
        attractionId: Long,
        source: AttractionLinkSource,
    ): AttractionLinkRequestJpaEntity?

    /** 수집 대상 — 실제로 열어본 곳부터. 한 번도 안 했거나(NULL) 유효 기간이 지난 것. */
    @Query(
        """
        SELECT r FROM AttractionLinkRequestJpaEntity r
        WHERE r.source = :source
          AND (r.nextAttemptAt IS NULL OR r.nextAttemptAt <= :now)
        ORDER BY r.viewCount DESC, r.requestedAt ASC
        """,
    )
    fun findDue(
        @Param("source") source: AttractionLinkSource,
        @Param("now") now: LocalDateTime,
        pageable: Pageable,
    ): List<AttractionLinkRequestJpaEntity>

    /**
     * 그날 쓴 외부 API 호출 수. 성공·빈결과·실패를 가리지 않는다 — 셋 다 실제로 호출을 썼다.
     * 성공 행을 지우지 않기로 한 것이 이 집계를 가능하게 한다.
     */
    fun countBySourceAndLastAttemptAtGreaterThanEqual(
        source: AttractionLinkSource,
        since: LocalDateTime,
    ): Long
}
