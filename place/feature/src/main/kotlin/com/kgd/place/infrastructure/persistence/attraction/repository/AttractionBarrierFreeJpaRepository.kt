package com.kgd.place.infrastructure.persistence.attraction.repository

import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionBarrierFreeJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionBarrierFreeJpaRepository : JpaRepository<AttractionBarrierFreeJpaEntity, Long> {

    fun findByContentIdIn(contentIds: Collection<String>): List<AttractionBarrierFreeJpaEntity>

    /** 상세 대상 선택용 상태 — 원문 컬럼을 읽지 않는다(약 1만 행). */
    @Query("SELECT b.contentId AS contentId, b.listModifiedAt AS listModifiedAt, b.detailSyncedAt AS detailSyncedAt FROM AttractionBarrierFreeJpaEntity b")
    fun findStates(): List<StateRow>

    /**
     * 원천 contentId → 관광지 id. 같은 언어 안의 TourAPI 행에만 잇는다 — 국문·영문은 contentId 체계가 다르고,
     * 다른 원천(고캠핑)은 번호 체계가 달라 같은 번호여도 다른 곳이다.
     * attractions 를 직접 읽는 것은 같은 스키마 안의 조인 키 조회라서다(비슷한 곳의 존재 확인과 같은 방식).
     */
    @Query(value = "SELECT id AS id, content_id AS contentId FROM attractions WHERE lang = :lang AND source = 'TOURAPI' AND content_id IN (:contentIds)", nativeQuery = true)
    fun findAttractionIds(@Param("lang") lang: String, @Param("contentIds") contentIds: Collection<String>): List<IdRow>

    interface StateRow {
        fun getContentId(): String
        fun getListModifiedAt(): LocalDateTime?
        fun getDetailSyncedAt(): LocalDateTime?
    }

    interface IdRow {
        fun getId(): Long
        fun getContentId(): String
    }
}
