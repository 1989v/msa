package com.kgd.codedictionary.application.portfolio.service

import com.kgd.codedictionary.application.portfolio.dto.PortfolioTimelineDto
import com.kgd.codedictionary.application.portfolio.dto.TimelineCategoryDto
import com.kgd.codedictionary.application.portfolio.dto.TimelineCompanyDto
import com.kgd.codedictionary.application.portfolio.dto.TimelineProjectDto
import com.kgd.codedictionary.application.resume.dto.CareerSummaryDto
import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCompanyRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.domain.resume.model.CareerCalculator
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.YearMonth

/**
 * 메인 포트폴리오 타임라인 조립 (ADR-0066).
 *
 * 이력서와 데이터는 공유하되 **공개 범위가 다르다.** 재직 기간·직무는 나가고,
 * 회사에서 무엇을 했는지는 나가지 않는다. 그래서 프로젝트는 개인 프로젝트만 읽는 전용
 * 포트 메서드를 쓴다 — 필터를 여기서 걸면 다음 사람이 빠뜨릴 수 있다.
 */
@Service
@Transactional(readOnly = true)
class PortfolioTimelineService(
    private val companyRepository: ResumeCompanyRepositoryPort,
    private val categoryRepository: ResumeCategoryRepositoryPort,
    private val projectRepository: ResumeProjectRepositoryPort,
) {

    fun timeline(): PortfolioTimelineDto {
        val asOf = LocalDate.now()
        val companies = companyRepository.findAll()
        val categories = categoryRepository.findAll()
        val projects = projectRepository.findAllPublishedPersonal()

        val categoryById = categories.associateBy { it.id }
        val tenure = CareerCalculator.tenure(companies.map { it.period }, asOf)

        return PortfolioTimelineDto(
            career = CareerSummaryDto(
                totalMonths = tenure.totalMonths,
                years = tenure.years,
                months = tenure.months,
                yearsInField = CareerCalculator.yearsInField(companies.map { it.period }, asOf),
            ),
            // 타임라인이라 최근이 위다. 이력서의 orderNo 정렬과 다르다.
            companies = companies
                .sortedByDescending { it.period.start }
                .map(TimelineCompanyDto::from),
            projects = projects
                .sortedByDescending { it.period?.start ?: YearMonth.of(MIN_YEAR, 1) }
                .map { project ->
                    TimelineProjectDto.from(project, project.categoryId?.let { categoryById[it] })
                },
            categories = categories.map(TimelineCategoryDto::from),
        )
    }

    private companion object {
        /** 기간이 비어 있는 프로젝트는 맨 아래로 */
        const val MIN_YEAR = 1
    }
}
