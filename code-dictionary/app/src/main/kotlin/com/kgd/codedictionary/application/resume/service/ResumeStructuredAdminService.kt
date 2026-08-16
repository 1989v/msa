package com.kgd.codedictionary.application.resume.service

import com.kgd.codedictionary.application.resume.dto.ResumeCategoryDto
import com.kgd.codedictionary.application.resume.dto.ResumeCategoryUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyDto
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeProjectUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupDto
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupUpsertRequest
import com.kgd.codedictionary.application.resume.dto.ResumeSkillUpsertRequest
import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCompanyRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectSkillRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillGroupRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillRepositoryPort
import com.kgd.codedictionary.domain.resume.model.CareerPeriod
import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import com.kgd.codedictionary.domain.resume.model.ResumeSkill
import com.kgd.codedictionary.domain.resume.model.ResumeSkillGroup
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException

@Service
class ResumeStructuredAdminService(
    private val companyRepository: ResumeCompanyRepositoryPort,
    private val categoryRepository: ResumeCategoryRepositoryPort,
    private val projectRepository: ResumeProjectRepositoryPort,
    private val skillGroupRepository: ResumeSkillGroupRepositoryPort,
    private val skillRepository: ResumeSkillRepositoryPort,
    private val projectSkillRepository: ResumeProjectSkillRepositoryPort,
) {

    @Transactional
    fun upsertCompany(request: ResumeCompanyUpsertRequest): ResumeCompanyDto {
        val saved = companyRepository.save(
            ResumeCompany(
                id = request.id,
                name = request.name,
                period = CareerPeriod(parseMonth(request.startMonth), request.endMonth?.let(::parseMonth)),
                position = request.position,
                team = request.team,
                note = request.note,
            ),
        )
        return ResumeCompanyDto.from(saved, LocalDate.now())
    }

    @Transactional
    fun deleteCompany(id: Long) = companyRepository.delete(id)

    @Transactional
    fun upsertCategory(request: ResumeCategoryUpsertRequest): ResumeCategoryDto =
        ResumeCategoryDto.from(
            categoryRepository.save(
                ResumeCategory(
                    id = request.id,
                    code = request.code.trim().lowercase(),
                    label = request.label,
                    description = request.description,
                    orderNo = request.orderNo ?: 0,
                ),
            ),
        )

    @Transactional
    fun deleteCategory(id: Long) = categoryRepository.delete(id)

    @Transactional
    fun upsertProject(request: ResumeProjectUpsertRequest): Long? {
        val period = request.startMonth?.let {
            CareerPeriod(parseMonth(it), request.endMonth?.let(::parseMonth))
        }
        return projectRepository.save(
            ResumeProject(
                id = request.id,
                title = request.title,
                companyId = request.companyId,
                categoryId = request.categoryId,
                period = period,
                summary = request.summary,
                bodyMarkdown = request.bodyMarkdown,
                publicBodyMarkdown = request.publicBodyMarkdown,
                metrics = request.metrics ?: emptyList(),
                skillIds = request.skillIds ?: emptyList(),
                detailSlug = request.detailSlug?.trim()?.lowercase()?.takeIf { it.isNotEmpty() },
                orderNo = request.orderNo ?: 0,
                published = request.published ?: true,
            ),
        ).id?.also { projectSkillRepository.replace(it, request.skillIds ?: emptyList()) }
    }

    @Transactional
    fun deleteProject(id: Long) = projectRepository.delete(id)

    @Transactional
    fun upsertSkillGroup(request: ResumeSkillGroupUpsertRequest): ResumeSkillGroupDto =
        ResumeSkillGroupDto.from(
            group = skillGroupRepository.save(
                ResumeSkillGroup(
                    id = request.id,
                    label = request.label,
                    note = request.note,
                    orderNo = request.orderNo ?: 0,
                ),
            ),
            // 그룹만 저장하는 경로다 — 소속 기술은 별도 조회에서 채운다
            skills = emptyList(),
        )

    @Transactional
    fun deleteSkillGroup(id: Long) = skillGroupRepository.delete(id)

    @Transactional
    fun upsertSkill(request: ResumeSkillUpsertRequest): Long? = skillRepository.save(
        ResumeSkill(
            id = request.id,
            name = request.name.trim(),
            groupId = request.groupId,
            orderNo = request.orderNo ?: 0,
        ),
    ).id

    @Transactional
    fun deleteSkill(id: Long) = skillRepository.delete(id)

    /** 화면에서 `2022-08` 형태로 들어온다. 일자는 받지 않는다 — 이력서에서 의미가 없다. */
    private fun parseMonth(raw: String): YearMonth = try {
        YearMonth.parse(raw.trim())
    } catch (e: DateTimeParseException) {
        throw BusinessException(ErrorCode.INVALID_INPUT, "기간은 YYYY-MM 형식이어야 합니다: $raw", e)
    }
}
