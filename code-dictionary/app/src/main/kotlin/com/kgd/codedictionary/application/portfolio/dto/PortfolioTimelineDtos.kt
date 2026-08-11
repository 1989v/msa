package com.kgd.codedictionary.application.portfolio.dto

import com.kgd.codedictionary.application.resume.dto.CareerSummaryDto
import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject

/**
 * 1989v.com 메인의 포트폴리오 타임라인 (ADR-0066).
 *
 * 이력서 API 와 달리 **게이트가 없는 공개 응답**이다. 그래서 이 파일의 DTO 는
 * 이력서 DTO 를 재사용하지 않고 따로 둔다 — 필드가 하나 늘어도 공개 범위가 조용히 넓어지지
 * 않아야 한다 (ADR-0064 개정).
 */
data class PortfolioTimelineDto(
    val career: CareerSummaryDto,
    val companies: List<TimelineCompanyDto>,
    val projects: List<TimelineProjectDto>,
    val categories: List<TimelineCategoryDto>,
)

/**
 * 재직 구간. 회사명·기간·직무까지만 싣는다.
 *
 * `note` 는 자유 서술 필드라 무엇이 적혀 있을지 보장할 수 없어 제외한다.
 */
data class TimelineCompanyDto(
    val name: String,
    val startMonth: String,
    val endMonth: String?,
    val ongoing: Boolean,
    val position: String?,
) {
    companion object {
        fun from(company: ResumeCompany) = TimelineCompanyDto(
            name = company.name,
            startMonth = company.period.start.toString(),
            endMonth = company.period.end?.toString(),
            ongoing = company.period.ongoing,
            position = company.position,
        )
    }
}

/**
 * 개인 프로젝트.
 *
 * **회사 연결 필드를 두지 않는다** — 실수로 채울 자리가 없어야 한다.
 * 상세 문서 slug 도 싣지 않는다. 상세는 게이트 뒤 resume 호스트에만 있어서
 * 메인에서 링크하면 깨진다.
 */
data class TimelineProjectDto(
    val title: String,
    val categoryCode: String?,
    val startMonth: String?,
    val endMonth: String?,
    val ongoing: Boolean,
    val summary: String?,
    val metrics: List<String>,
    val tags: List<String>,
) {
    companion object {
        fun from(project: ResumeProject, category: ResumeCategory?) = TimelineProjectDto(
            title = project.title,
            categoryCode = category?.code,
            startMonth = project.period?.start?.toString(),
            endMonth = project.period?.end?.toString(),
            ongoing = project.period?.ongoing ?: false,
            summary = project.summary,
            metrics = project.metrics,
            tags = project.tags,
        )
    }
}

data class TimelineCategoryDto(
    val code: String,
    val label: String,
) {
    companion object {
        fun from(category: ResumeCategory) = TimelineCategoryDto(
            code = category.code,
            label = category.label,
        )
    }
}
