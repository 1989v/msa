package com.kgd.codedictionary.application.resume.port

import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility

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
