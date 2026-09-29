package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionJpaEntity
import org.springframework.data.domain.Limit
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionJpaRepository : JpaRepository<AttractionJpaEntity, Long> {

    @Query("SELECT MAX(a.introSyncedAt) FROM AttractionJpaEntity a")
    fun findLatestIntroSyncedAt(): LocalDateTime?

    fun findByContentIdIn(contentIds: Collection<String>): List<AttractionJpaEntity>

    fun findByLang(lang: String, pageable: Pageable): Page<AttractionJpaEntity>

    /** 키셋 풀스캔 — PK 범위 스캔이라 뒤 페이지도 첫 페이지만큼 빠르고, List 반환이라 count 쿼리가 없다. */
    fun findByIdGreaterThanOrderByIdAsc(afterId: Long, limit: Limit): List<AttractionJpaEntity>

    fun findByLangAndIdGreaterThanOrderByIdAsc(lang: String, afterId: Long, limit: Limit): List<AttractionJpaEntity>

    /** 구글 place_id 미보강분 — Pageable 정렬(id)로 안정된 스캔 순서를 보장한다. */
    fun findByGooglePlaceIdIsNullAndStatus(status: String, pageable: Pageable): Page<AttractionJpaEntity>

    fun findByGooglePlaceIdIsNullAndStatusAndLang(
        status: String,
        lang: String,
        pageable: Pageable,
    ): Page<AttractionJpaEntity>

    /**
     * 법정동 축의 관광지 건수 (ADR-0071). 드릴다운이 "몇 곳"을 보여주는 근거다.
     * `area_code`/`sigungu_code` 가 아니라 법정동 코드로 센다 — 그 두 컬럼은 코드 체계가 섞여 있다.
     */
    @Query(
        """
        SELECT a.ldongRegnCd AS regnCode, a.ldongSignguCd AS signguCode, COUNT(a.id) AS total
        FROM AttractionJpaEntity a
        WHERE a.lang = :lang
          AND a.status = 'ACTIVE'
          AND a.category IN :categories
          AND a.ldongRegnCd IS NOT NULL
        GROUP BY a.ldongRegnCd, a.ldongSignguCd
        """,
    )
    fun countByLdong(
        @Param("lang") lang: String,
        @Param("categories") categories: Collection<String>,
    ): List<LdongCountProjection>

    interface LdongCountProjection {
        fun getRegnCode(): String
        fun getSignguCode(): String?
        fun getTotal(): Long
    }
}
