package com.kgd.codedictionary.presentation.resume.controller

import com.kgd.codedictionary.application.resume.dto.ResumeCategoryDto
import com.kgd.codedictionary.application.resume.dto.ResumeCategoryUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyDto
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeProfileDto
import com.kgd.codedictionary.application.resume.dto.ResumeProjectUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupDto
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSkillUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSnippetUpsertRequest
import com.kgd.codedictionary.application.resume.usecase.GetResumeProfileUseCase
import com.kgd.codedictionary.application.resume.usecase.ManageResumeStructureUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 이력서 구조화 영역 어드민 API (ADR-0064).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다.
 */
@RestController
@RequestMapping("/api/v1/admin/resume")
class ResumeStructuredAdminController(
    private val getProfile: GetResumeProfileUseCase,
    private val adminService: ManageResumeStructureUseCase,
) {

    /** 어드민은 미공개 프로젝트까지 본다 */
    @GetMapping("/profile")
    fun profile(): ApiResponse<ResumeProfileDto> =
        ApiResponse.success(getProfile.profile(includeUnpublished = true))

    @PutMapping("/companies")
    fun upsertCompany(@RequestBody request: ResumeCompanyUpsertRequest): ApiResponse<ResumeCompanyDto> =
        ApiResponse.success(adminService.upsertCompany(request))

    @DeleteMapping("/companies/{id}")
    fun deleteCompany(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteCompany(id)
        return ApiResponse.success(Unit)
    }

    @PutMapping("/categories")
    fun upsertCategory(@RequestBody request: ResumeCategoryUpsertRequest): ApiResponse<ResumeCategoryDto> =
        ApiResponse.success(adminService.upsertCategory(request))

    @DeleteMapping("/categories/{id}")
    fun deleteCategory(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteCategory(id)
        return ApiResponse.success(Unit)
    }

    @PutMapping("/projects")
    fun upsertProject(@RequestBody request: ResumeProjectUpsertRequest): ApiResponse<Map<String, Long?>> =
        ApiResponse.success(mapOf("id" to adminService.upsertProject(request)))

    @DeleteMapping("/projects/{id}")
    fun deleteProject(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteProject(id)
        return ApiResponse.success(Unit)
    }

    @PutMapping("/skill-groups")
    fun upsertSkillGroup(
        @RequestBody request: ResumeSkillGroupUpsertRequest,
    ): ApiResponse<ResumeSkillGroupDto> = ApiResponse.success(adminService.upsertSkillGroup(request))

    @DeleteMapping("/skill-groups/{id}")
    fun deleteSkillGroup(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteSkillGroup(id)
        return ApiResponse.success(Unit)
    }

    @PutMapping("/skills")
    fun upsertSkill(@RequestBody request: ResumeSkillUpsertRequest): ApiResponse<Map<String, Long?>> =
        ApiResponse.success(mapOf("id" to adminService.upsertSkill(request)))

    @DeleteMapping("/skills/{id}")
    fun deleteSkill(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteSkill(id)
        return ApiResponse.success(Unit)
    }

    /** 목록은 `/profile` 이 프로젝트에 실어 내려준다. 순서 변경도 orderNo 를 실은 upsert 다. */
    @PutMapping("/snippets")
    fun upsertSnippet(@RequestBody request: ResumeSnippetUpsertRequest): ApiResponse<Map<String, Long?>> =
        ApiResponse.success(mapOf("id" to adminService.upsertSnippet(request)))

    @DeleteMapping("/snippets/{id}")
    fun deleteSnippet(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteSnippet(id)
        return ApiResponse.success(Unit)
    }
}
