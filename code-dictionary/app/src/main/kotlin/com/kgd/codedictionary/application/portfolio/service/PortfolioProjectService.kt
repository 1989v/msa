package com.kgd.codedictionary.application.portfolio.service

import com.kgd.codedictionary.application.portfolio.dto.PortfolioCategoryDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioProjectDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioProjectsDto
import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectSkillRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillRepositoryPort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * `/portfolio` 공개 아카이브 조립 (ADR-0066 개정).
 *
 * 메인 타임라인([PortfolioTimelineService])과 **공개 범위가 다르다.** 타임라인은 개인
 * 프로젝트만 싣지만 여기는 공개로 표시된 것 전부를 싣는다 — 대신 **어느 회사에서 한
 * 일인지는 나가지 않는다.** 회사를 지우는 일은 DTO 가 맡는다: 필드가 없으므로 이 서비스가
 * 실수로 채울 방법이 없다.
 *
 * 그래서 회사 저장소를 주입하지 않는다. 쓰지 않는 의존이 있으면 다음 사람이 쓴다.
 */
@Service
@Transactional(readOnly = true)
class PortfolioProjectService(
    private val categoryRepository: ResumeCategoryRepositoryPort,
    private val projectRepository: ResumeProjectRepositoryPort,
    private val skillRepository: ResumeSkillRepositoryPort,
    private val projectSkillRepository: ResumeProjectSkillRepositoryPort,
) {

    fun projects(): PortfolioProjectsDto {
        val categories = categoryRepository.findAll()
        val categoryById = categories.associateBy { it.id }
        val skillNameById = skillRepository.findAll()
            .mapNotNull { skill -> skill.id?.let { it to skill.name } }
            .toMap()
        val skillIdsByProject = projectSkillRepository.skillIdsByProject()

        val projects = projectRepository.findAllPublished()
            .sortedBy { it.orderNo }
            .map { project ->
                PortfolioProjectDto.from(
                    project = project,
                    category = project.categoryId?.let { categoryById[it] },
                    tags = project.id
                        ?.let { skillIdsByProject[it] }
                        ?.mapNotNull { skillNameById[it] }
                        ?: emptyList(),
                )
            }

        return PortfolioProjectsDto(
            projects = projects,
            categories = categories.map(PortfolioCategoryDto::from),
        )
    }
}
