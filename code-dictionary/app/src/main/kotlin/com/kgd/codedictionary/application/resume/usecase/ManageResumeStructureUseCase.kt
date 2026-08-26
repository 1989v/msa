package com.kgd.codedictionary.application.resume.usecase

import com.kgd.codedictionary.application.resume.dto.ResumeCategoryDto
import com.kgd.codedictionary.application.resume.dto.ResumeCategoryUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyDto
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeProjectUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupDto
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSkillUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSnippetUpsertRequest

/** 이력서 구조화 데이터(회사·분류·프로젝트·스킬·스니펫) 어드민. */
interface ManageResumeStructureUseCase {
    fun upsertCompany(request: ResumeCompanyUpsertRequest): ResumeCompanyDto
    fun deleteCompany(id: Long)
    fun upsertCategory(request: ResumeCategoryUpsertRequest): ResumeCategoryDto
    fun deleteCategory(id: Long)
    fun upsertProject(request: ResumeProjectUpsertRequest): Long?
    fun deleteProject(id: Long)
    fun upsertSkillGroup(request: ResumeSkillGroupUpsertRequest): ResumeSkillGroupDto
    fun deleteSkillGroup(id: Long)
    fun upsertSkill(request: ResumeSkillUpsertRequest): Long?
    fun deleteSkill(id: Long)
    fun upsertSnippet(request: ResumeSnippetUpsertRequest): Long?
    fun deleteSnippet(id: Long)
}
