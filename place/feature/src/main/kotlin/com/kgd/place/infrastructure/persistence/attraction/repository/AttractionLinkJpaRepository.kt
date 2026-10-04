package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.domain.attraction.model.AttractionLinkSource
import com.kgd.place.domain.attraction.model.VideoFormat
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionLinkJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionLinkRequestJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionLinkJpaRepository : JpaRepository<AttractionLinkJpaEntity, Long> {
    fun findByAttractionIdOrderBySourceAscSortOrderAsc(attractionId: Long): List<AttractionLinkJpaEntity>

    fun deleteByAttractionIdAndSource(attractionId: Long, source: AttractionLinkSource)

    /** 길이·비율을 아직 모르는 영상 id — 같은 영상이 여러 관광지에 붙어 있어 중복을 걷는다. */
    @Query(
        """
        SELECT DISTINCT l.externalId FROM AttractionLinkJpaEntity l
        WHERE l.source = com.kgd.place.domain.attraction.model.AttractionLinkSource.YOUTUBE
          AND (l.duration IS NULL OR l.embedWidth IS NULL)
        """,
    )
    fun findVideoIdsMissingDetails(pageable: Pageable): List<String>

    @Modifying
    @Query(
        """
        UPDATE AttractionLinkJpaEntity l
        SET l.duration = :duration, l.embedWidth = :embedWidth, l.embedHeight = :embedHeight,
            l.videoFormat = :videoFormat
        WHERE l.source = com.kgd.place.domain.attraction.model.AttractionLinkSource.YOUTUBE
          AND l.externalId = :externalId
        """,
    )
    fun updateVideoDetails(
        @Param("externalId") externalId: String,
        @Param("duration") duration: String?,
        @Param("embedWidth") embedWidth: Int?,
        @Param("embedHeight") embedHeight: Int?,
        @Param("videoFormat") videoFormat: VideoFormat?,
    ): Int
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
