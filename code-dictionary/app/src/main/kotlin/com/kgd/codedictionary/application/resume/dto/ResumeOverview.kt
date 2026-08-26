package com.kgd.codedictionary.application.resume.dto

data class ResumeOverview(
    val main: ResumeDocumentDto?,
    val details: List<ResumeDocumentSummaryDto>,
    /** 경력·프로젝트·기술 스택 — 마크다운의 자리표시자를 채운다 */
    val profile: ResumeProfileDto,
)
