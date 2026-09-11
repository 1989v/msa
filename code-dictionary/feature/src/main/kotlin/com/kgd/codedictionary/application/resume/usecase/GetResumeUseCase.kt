package com.kgd.codedictionary.application.resume.usecase

import com.kgd.codedictionary.application.resume.dto.ResumeDocumentDto
import com.kgd.codedictionary.application.resume.dto.ResumeStatusDto
import com.kgd.codedictionary.application.resume.dto.ResumeOverview

/** 이력서 공개 조회 — 제출처별 토큰 게이트 (ADR-0064). */
interface GetResumeUseCase {
    fun status(): ResumeStatusDto
    fun overview(token: String?): ResumeOverview
    fun document(slug: String, token: String?): ResumeDocumentDto
}
