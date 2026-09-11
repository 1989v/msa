package com.kgd.codedictionary.presentation.resume.controller

import com.kgd.codedictionary.application.resume.dto.ResumeDocumentDto
import com.kgd.codedictionary.application.resume.dto.ResumeStatusDto
import com.kgd.codedictionary.application.resume.dto.ResumeOverview
import com.kgd.codedictionary.application.resume.usecase.GetResumeUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 공개 이력서 API (ADR-0064). 게이트를 통과하지 못하면 404. */
@RestController
@RequestMapping("/api/v1/resume")
class ResumeController(
    private val getResume: GetResumeUseCase,
) {

    /**
     * 공개 여부만 반환한다. 메인 포털이 이력서 진입점을 노출할지 판단하는 용도라
     * 게이트를 걸지 않는다 — 개인정보는 싣지 않는다.
     */
    @GetMapping("/status")
    fun status(): ApiResponse<ResumeStatusDto> = ApiResponse.success(getResume.status())

    @GetMapping("/overview")
    fun overview(@RequestParam(required = false) token: String?): ApiResponse<ResumeOverview> =
        ApiResponse.success(getResume.overview(token))

    @GetMapping("/documents/{slug}")
    fun document(
        @PathVariable slug: String,
        @RequestParam(required = false) token: String?,
    ): ApiResponse<ResumeDocumentDto> = ApiResponse.success(getResume.document(slug, token))
}
