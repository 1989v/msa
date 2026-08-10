package com.kgd.codedictionary.application.resume.dto

import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeDocumentKind
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility
import java.time.LocalDateTime

/** 메인이 이력서 진입점을 노출할지 판단하는 용도. 개인정보를 싣지 않는다 (ADR-0064). */
data class ResumeStatusDto(val publiclyVisible: Boolean)

data class ResumeDocumentDto(
    val slug: String,
    val title: String,
    val bodyMarkdown: String,
    val kind: ResumeDocumentKind,
    val orderNo: Int,
) {
    companion object {
        fun from(doc: ResumeDocument) = ResumeDocumentDto(
            slug = doc.slug,
            title = doc.title,
            bodyMarkdown = doc.bodyMarkdown,
            kind = doc.kind,
            orderNo = doc.orderNo,
        )
    }
}

/** 목록 응답 — 본문 없이 슬러그·제목만. 상세 링크 구성용. */
data class ResumeDocumentSummaryDto(
    val slug: String,
    val title: String,
    val kind: ResumeDocumentKind,
    val orderNo: Int,
    val published: Boolean,
    val updatedAt: LocalDateTime?,
) {
    companion object {
        fun from(doc: ResumeDocument) = ResumeDocumentSummaryDto(
            slug = doc.slug,
            title = doc.title,
            kind = doc.kind,
            orderNo = doc.orderNo,
            published = doc.published,
            updatedAt = doc.updatedAt,
        )
    }
}

data class ResumeDocumentUpsertRequest(
    val slug: String,
    val title: String,
    val bodyMarkdown: String,
    val kind: String?,
    val orderNo: Int = 0,
    val published: Boolean = true,
)

data class ResumeShareLinkDto(
    val id: Long,
    val token: String,
    val label: String,
    val note: String?,
    val createdAt: LocalDateTime?,
    val revokedAt: LocalDateTime?,
    val visitCount: Long,
    val firstVisitedAt: LocalDateTime?,
    val lastVisitedAt: LocalDateTime?,
) {
    companion object {
        fun from(
            link: ResumeShareLink,
            visitCount: Long,
            firstVisitedAt: LocalDateTime?,
            lastVisitedAt: LocalDateTime?,
        ) = ResumeShareLinkDto(
            id = requireNotNull(link.id) { "저장된 공유 링크여야 합니다" },
            token = link.token,
            label = link.label,
            note = link.note,
            createdAt = link.createdAt,
            revokedAt = link.revokedAt,
            visitCount = visitCount,
            firstVisitedAt = firstVisitedAt,
            lastVisitedAt = lastVisitedAt,
        )
    }
}

data class ResumeShareLinkCreateRequest(val label: String, val note: String? = null)

data class ResumeVisibilityUpdateRequest(val visibility: String) {
    fun toDomain(): ResumeVisibility = ResumeVisibility.parse(visibility)
}

data class ResumeVisitDto(
    val label: String?,
    val slug: String,
    val visitedAt: LocalDateTime,
)
