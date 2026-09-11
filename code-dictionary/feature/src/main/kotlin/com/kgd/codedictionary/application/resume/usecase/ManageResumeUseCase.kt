package com.kgd.codedictionary.application.resume.usecase

import com.kgd.codedictionary.application.resume.dto.ResumeDocumentSummaryDto
import com.kgd.codedictionary.application.resume.dto.ResumeDocumentUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkCreateRequest
import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkDto
import com.kgd.codedictionary.application.resume.dto.ResumeVisitDto
import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility

/** 이력서 문서·공유링크·공개설정·열람기록 어드민. */
interface ManageResumeUseCase {
    fun listDocuments(): List<ResumeDocumentSummaryDto>
    fun getDocument(slug: String): ResumeDocument?
    fun upsertDocument(request: ResumeDocumentUpsertRequest): ResumeDocumentSummaryDto
    fun deleteDocument(slug: String)
    fun listShareLinks(): List<ResumeShareLinkDto>
    fun createShareLink(request: ResumeShareLinkCreateRequest): ResumeShareLinkDto
    fun revokeShareLink(id: Long)
    fun currentVisibility(): ResumeVisibility
    fun updateVisibility(visibility: ResumeVisibility)
    fun recentVisits(limit: Int): List<ResumeVisitDto>
}
