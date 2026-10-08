package com.kgd.codedictionary.infrastructure.persistence.resume.repository

import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeAccessLogJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeDocumentJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSettingJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeShareLinkJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeShortLinkClickJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeShortLinkStatJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface ResumeDocumentJpaRepository : JpaRepository<ResumeDocumentJpaEntity, Long> {
    fun findBySlug(slug: String): ResumeDocumentJpaEntity?
    fun findAllByPublishedTrue(): List<ResumeDocumentJpaEntity>
    fun deleteBySlug(slug: String)
}

interface ResumeShareLinkJpaRepository : JpaRepository<ResumeShareLinkJpaEntity, Long> {
    fun findByToken(token: String): ResumeShareLinkJpaEntity?
    fun findByShortCode(shortCode: String): ResumeShareLinkJpaEntity?
    fun existsByShortCode(shortCode: String): Boolean
}

interface ResumeShortLinkClickJpaRepository : JpaRepository<ResumeShortLinkClickJpaEntity, Long> {

    /** 보존기간 초과분 정리 — retention CronJob 이 부른다 (ADR-0077) */
    @Modifying
    @Query("DELETE FROM ResumeShortLinkClickJpaEntity c WHERE c.clickedAt < :cutoff")
    fun deleteOlderThan(@Param("cutoff") cutoff: LocalDateTime): Int
}

interface ResumeShortLinkStatJpaRepository : JpaRepository<ResumeShortLinkStatJpaEntity, Long> {

    /** 읽고-더하고-쓰기를 하면 동시 클릭이 서로를 덮는다. 한 문장으로 올린다. */
    @Modifying
    @Query(
        value = """
        INSERT INTO resume_short_link_stat (share_link_id, click_count) VALUES (:shareLinkId, 1)
        ON DUPLICATE KEY UPDATE click_count = click_count + 1
        """,
        nativeQuery = true,
    )
    fun increment(@Param("shareLinkId") shareLinkId: Long): Int
}

interface ResumeSettingJpaRepository : JpaRepository<ResumeSettingJpaEntity, Long>

interface ResumeAccessLogJpaRepository : JpaRepository<ResumeAccessLogJpaEntity, Long> {

    /** 토큰별 집계 — 링크 목록 화면이 제출처 단위로 열람 여부를 보여주는 데 쓴다. */
    @Query(
        """
        SELECT l.shareLinkId, COUNT(l), MIN(l.visitedAt), MAX(l.visitedAt)
        FROM ResumeAccessLogJpaEntity l
        WHERE l.shareLinkId IS NOT NULL
        GROUP BY l.shareLinkId
        """,
    )
    fun aggregateByShareLink(): List<Array<Any>>

    @Query(
        """
        SELECT l.shareLinkId, s.label, l.slug, l.visitedAt
        FROM ResumeAccessLogJpaEntity l
        LEFT JOIN ResumeShareLinkJpaEntity s ON s.id = l.shareLinkId
        ORDER BY l.visitedAt DESC
        """,
    )
    fun findRecentWithLabel(pageable: Pageable): List<Array<Any?>>

    /** 보존기간 초과분 정리 — retention CronJob 이 부른다 (ADR-0077) */
    @Modifying
    @Query("DELETE FROM ResumeAccessLogJpaEntity l WHERE l.visitedAt < :cutoff")
    fun deleteOlderThan(@Param("cutoff") cutoff: LocalDateTime): Int
}
