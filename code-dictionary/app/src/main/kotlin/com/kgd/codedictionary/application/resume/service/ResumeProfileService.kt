package com.kgd.codedictionary.application.resume.service

import com.kgd.codedictionary.application.resume.dto.CareerSummaryDto
import com.kgd.codedictionary.application.resume.dto.ResumeCategoryDto
import com.kgd.codedictionary.application.resume.dto.ResumeCodeSnippetDto
import com.kgd.codedictionary.application.resume.dto.ResumeCompanyDto
import com.kgd.codedictionary.application.resume.dto.ResumeProfileDto
import com.kgd.codedictionary.application.resume.dto.ResumeProjectDto
import com.kgd.codedictionary.application.resume.dto.ResumeSkillGroupDto
import com.kgd.codedictionary.application.resume.dto.ResumeSkillRefDto
import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCodeSnippetRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCompanyRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectSkillRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillGroupRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillRepositoryPort
import com.kgd.codedictionary.domain.resume.model.CareerCalculator
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/**
 * 구조화 영역 조립 (ADR-0064).
 *
 * 게이트 판정은 호출부(ResumeQueryService)가 이미 마쳤다는 전제다 — 여기서는 조립만 한다.
 */
@Service
class ResumeProfileService(
    private val companyRepository: ResumeCompanyRepositoryPort,
    private val categoryRepository: ResumeCategoryRepositoryPort,
    private val projectRepository: ResumeProjectRepositoryPort,
    private val skillGroupRepository: ResumeSkillGroupRepositoryPort,
    private val skillRepository: ResumeSkillRepositoryPort,
    private val projectSkillRepository: ResumeProjectSkillRepositoryPort,
    private val codeSnippetRepository: ResumeCodeSnippetRepositoryPort,
) {

    @Transactional(readOnly = true)
    fun profile(includeUnpublished: Boolean = false): ResumeProfileDto {
        val asOf = LocalDate.now()
        val companies = companyRepository.findAll()
        val categories = categoryRepository.findAll()
        val projects = if (includeUnpublished) projectRepository.findAll() else projectRepository.findAllPublished()

        val companyById = companies.associateBy { it.id }
        val categoryById = categories.associateBy { it.id }

        val skills = skillRepository.findAll()
        val skillRefById = skills.mapNotNull { s -> s.id?.let { it to ResumeSkillRefDto(it, s.name) } }.toMap()
        val skillIdsByProject = projectSkillRepository.skillIdsByProject()
        // 이력서는 게이트 뒤(ADR-0064)라 스니펫을 항상 전문으로 싣는다 — 잠금은 공개면의 일이다
        val snippetsByProject = codeSnippetRepository.snippetsByProject()

        val tenure = CareerCalculator.tenure(companies.map { it.period }, asOf)
        return ResumeProfileDto(
            career = CareerSummaryDto(
                totalMonths = tenure.totalMonths,
                years = tenure.years,
                months = tenure.months,
                yearsInField = CareerCalculator.yearsInField(companies.map { it.period }, asOf),
            ),
            companies = companies.map { ResumeCompanyDto.from(it, asOf) },
            categories = categories.map(ResumeCategoryDto::from),
            projects = projects.map { project ->
                ResumeProjectDto.from(
                    project = project,
                    company = project.companyId?.let { companyById[it] },
                    category = project.categoryId?.let { categoryById[it] },
                    skills = project.id
                        ?.let { skillIdsByProject[it] }
                        ?.mapNotNull { skillRefById[it] }
                        ?: emptyList(),
                    snippets = project.id
                        ?.let { snippetsByProject[it] }
                        ?.map(ResumeCodeSnippetDto::from)
                        ?: emptyList(),
                )
            },
            skills = skillGroupRepository.findAll().map { group ->
                ResumeSkillGroupDto.from(
                    group = group,
                    skills = skills
                        .filter { it.groupId == group.id }
                        .mapNotNull { s -> s.id?.let { ResumeSkillRefDto(it, s.name) } },
                )
            },
        )
    }
}
