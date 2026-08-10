package com.kgd.codedictionary.presentation.resume.controller

import com.kgd.codedictionary.application.resume.dto.ResumeDocumentDto
import com.kgd.codedictionary.application.resume.dto.ResumeDocumentSummaryDto
import com.kgd.codedictionary.application.resume.dto.ResumeDocumentUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkCreateRequest
import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkDto
import com.kgd.codedictionary.application.resume.dto.ResumeVisibilityUpdateRequest
import com.kgd.codedictionary.application.resume.dto.ResumeVisitDto
import com.kgd.codedictionary.application.resume.service.ResumeAdminService
import com.kgd.common.exception.NotFoundException
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 이력서 어드민 API (ADR-0064).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다 (ADR-0063 어드민 단일 호스트).
 */
@RestController
@RequestMapping("/api/v1/admin/resume")
class ResumeAdminController(
    private val resumeAdminService: ResumeAdminService,
) {

    @GetMapping("/documents")
    fun listDocuments(): ApiResponse<List<ResumeDocumentSummaryDto>> =
        ApiResponse.success(resumeAdminService.listDocuments())

    @GetMapping("/documents/{slug}")
    fun getDocument(@PathVariable slug: String): ApiResponse<ResumeDocumentDto> {
        val document = resumeAdminService.getDocument(slug) ?: throw NotFoundException("ResumeDocument", slug)
        return ApiResponse.success(ResumeDocumentDto.from(document))
    }

    @PutMapping("/documents")
    fun upsertDocument(
        @RequestBody request: ResumeDocumentUpsertRequest,
    ): ApiResponse<ResumeDocumentSummaryDto> = ApiResponse.success(resumeAdminService.upsertDocument(request))

    @DeleteMapping("/documents/{slug}")
    fun deleteDocument(@PathVariable slug: String): ApiResponse<Unit> {
        resumeAdminService.deleteDocument(slug)
        return ApiResponse.success(Unit)
    }

    @GetMapping("/share-links")
    fun listShareLinks(): ApiResponse<List<ResumeShareLinkDto>> =
        ApiResponse.success(resumeAdminService.listShareLinks())

    @PostMapping("/share-links")
    fun createShareLink(
        @RequestBody request: ResumeShareLinkCreateRequest,
    ): ApiResponse<ResumeShareLinkDto> = ApiResponse.success(resumeAdminService.createShareLink(request))

    @DeleteMapping("/share-links/{id}")
    fun revokeShareLink(@PathVariable id: Long): ApiResponse<Unit> {
        resumeAdminService.revokeShareLink(id)
        return ApiResponse.success(Unit)
    }

    @GetMapping("/visibility")
    fun visibility(): ApiResponse<Map<String, String>> =
        ApiResponse.success(mapOf("visibility" to resumeAdminService.currentVisibility().name))

    @PutMapping("/visibility")
    fun updateVisibility(
        @RequestBody request: ResumeVisibilityUpdateRequest,
    ): ApiResponse<Map<String, String>> {
        resumeAdminService.updateVisibility(request.toDomain())
        return ApiResponse.success(mapOf("visibility" to resumeAdminService.currentVisibility().name))
    }

    @GetMapping("/visits")
    fun visits(@RequestParam(defaultValue = "100") limit: Int): ApiResponse<List<ResumeVisitDto>> =
        ApiResponse.success(resumeAdminService.recentVisits(limit.coerceIn(1, 500)))
}
