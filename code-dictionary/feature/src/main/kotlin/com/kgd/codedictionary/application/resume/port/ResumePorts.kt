package com.kgd.codedictionary.application.resume.port

import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility

import java.time.LocalDateTime

interface ResumeDocumentRepositoryPort {
    fun findAllPublished(): List<ResumeDocument>
    fun findAll(): List<ResumeDocument>
    fun findBySlug(slug: String): ResumeDocument?
    fun save(document: ResumeDocument): ResumeDocument
    fun deleteBySlug(slug: String)
}

interface ResumeShareLinkRepositoryPort {
    fun findByToken(token: String): ResumeShareLink?
    fun findAll(): List<ResumeShareLink>
    fun save(link: ResumeShareLink): ResumeShareLink
    fun revoke(id: Long)
}

interface ResumeAccessLogRepositoryPort {
    fun record(shareLinkId: Long?, slug: String)
    fun countByShareLink(): Map<Long, ResumeVisitStats>
    fun findRecent(limit: Int): List<ResumeVisitRecord>

    /**
     * 보존기간 초과분 정리 (ADR-0077).
     *
     * 지운 만큼 [countByShareLink] 의 방문 수가 줄어든다 — 이 원장이 통계의 원본이라
     * 별도 누계 컬럼이 없다. 보존기간을 지원 주기보다 길게 잡는 이유가 이것이다.
     */
    fun purgeOlderThan(cutoff: LocalDateTime): Int
}

interface ResumeSettingRepositoryPort {
    fun currentVisibility(): ResumeVisibility
    fun updateVisibility(visibility: ResumeVisibility)
}

data class ResumeVisitStats(
    val visitCount: Long,
    val firstVisitedAt: java.time.LocalDateTime?,
    val lastVisitedAt: java.time.LocalDateTime?,
)

data class ResumeVisitRecord(
    val shareLinkId: Long?,
    val label: String?,
    val slug: String,
    val visitedAt: java.time.LocalDateTime,
)
