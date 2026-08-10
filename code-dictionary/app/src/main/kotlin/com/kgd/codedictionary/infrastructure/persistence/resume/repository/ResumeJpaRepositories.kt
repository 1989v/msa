package com.kgd.codedictionary.infrastructure.persistence.resume.repository

import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeAccessLogJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeDocumentJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeSettingJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.resume.entity.ResumeShareLinkJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ResumeDocumentJpaRepository : JpaRepository<ResumeDocumentJpaEntity, Long> {
    fun findBySlug(slug: String): ResumeDocumentJpaEntity?
    fun findAllByPublishedTrue(): List<ResumeDocumentJpaEntity>
    fun deleteBySlug(slug: String)
}

interface ResumeShareLinkJpaRepository : JpaRepository<ResumeShareLinkJpaEntity, Long> {
    fun findByToken(token: String): ResumeShareLinkJpaEntity?
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
}
