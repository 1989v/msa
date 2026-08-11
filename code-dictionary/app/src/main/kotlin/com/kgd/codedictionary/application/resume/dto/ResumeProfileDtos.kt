package com.kgd.codedictionary.application.resume.dto

import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import com.kgd.codedictionary.domain.resume.model.ResumeSkillGroup
import java.time.LocalDate
import java.time.YearMonth

/**
 * 이력서의 구조화 영역 (ADR-0064).
 *
 * 서술은 마크다운 문서가 담당하고, 여기에는 시간이 지나면 틀려지거나 계속 늘어나는 것만 담는다.
 */
data class ResumeProfileDto(
    val career: CareerSummaryDto,
    val companies: List<ResumeCompanyDto>,
    val categories: List<ResumeCategoryDto>,
    val projects: List<ResumeProjectDto>,
    val skills: List<ResumeSkillGroupDto>,
)

/** 손으로 적지 않고 재직 기간에서 계산한다 — 매달 저절로 맞는다. */
data class CareerSummaryDto(
    val totalMonths: Int,
    val years: Int,
    val months: Int,
    /** 국내 관행의 "N년차" */
    val yearsInField: Int,
)

data class ResumeCompanyDto(
    val id: Long?,
    val name: String,
    val startMonth: String,
    val endMonth: String?,
    val ongoing: Boolean,
    val position: String?,
    val team: String?,
    val note: String?,
    val tenureMonths: Int,
    val tenureYears: Int,
    val tenureRemainderMonths: Int,
) {
    companion object {
        fun from(company: ResumeCompany, asOf: LocalDate): ResumeCompanyDto {
            val tenure = company.tenure(asOf)
            return ResumeCompanyDto(
                id = company.id,
                name = company.name,
                startMonth = company.period.start.format(),
                endMonth = company.period.end?.format(),
                ongoing = company.period.ongoing,
                position = company.position,
                team = company.team,
                note = company.note,
                tenureMonths = tenure.totalMonths,
                tenureYears = tenure.years,
                tenureRemainderMonths = tenure.months,
            )
        }
    }
}

data class ResumeCategoryDto(
    val id: Long?,
    val code: String,
    val label: String,
    val description: String?,
    val orderNo: Int,
) {
    companion object {
        fun from(category: ResumeCategory) = ResumeCategoryDto(
            id = category.id,
            code = category.code,
            label = category.label,
            description = category.description,
            orderNo = category.orderNo,
        )
    }
}

data class ResumeProjectDto(
    val id: Long?,
    val title: String,
    val companyId: Long?,
    val companyName: String?,
    val categoryId: Long?,
    val categoryCode: String?,
    val categoryLabel: String?,
    val startMonth: String?,
    val endMonth: String?,
    val ongoing: Boolean,
    val summary: String?,
    val bodyMarkdown: String?,
    val metrics: List<String>,
    /** 카탈로그 기술 참조 — 화면이 이 id 로 같은 기술의 프로젝트를 모아본다 */
    val skills: List<ResumeSkillRefDto>,
    val detailSlug: String?,
    val orderNo: Int,
    val published: Boolean,
) {
    companion object {
        fun from(
            project: ResumeProject,
            company: ResumeCompany?,
            category: ResumeCategory?,
            skills: List<ResumeSkillRefDto> = emptyList(),
        ) = ResumeProjectDto(
            id = project.id,
            title = project.title,
            companyId = project.companyId,
            companyName = company?.name,
            categoryId = project.categoryId,
            categoryCode = category?.code,
            categoryLabel = category?.label,
            startMonth = project.period?.start?.format(),
            endMonth = project.period?.end?.format(),
            ongoing = project.period?.ongoing ?: false,
            summary = project.summary,
            bodyMarkdown = project.bodyMarkdown,
            metrics = project.metrics,
            skills = skills,
            detailSlug = project.detailSlug,
            orderNo = project.orderNo,
            published = project.published,
        )
    }
}

/** 기술 한 건의 최소 표현 — 화면이 식별하고 모아보는 데 필요한 만큼만 */
data class ResumeSkillRefDto(val id: Long, val name: String)

data class ResumeSkillGroupDto(
    val id: Long?,
    val label: String,
    val skills: List<ResumeSkillRefDto>,
    val note: String?,
    val orderNo: Int,
) {
    companion object {
        fun from(group: ResumeSkillGroup, skills: List<ResumeSkillRefDto>) = ResumeSkillGroupDto(
            id = group.id,
            label = group.label,
            skills = skills,
            note = group.note,
            orderNo = group.orderNo,
        )
    }
}

/** `2022-08` — 화면이 그대로 쓰거나 다시 쪼갤 수 있게 ISO 로 내보낸다. */
internal fun YearMonth.format(): String = toString()

// ─── 어드민 요청 ─────────────────────────────────────────────────────────────

data class ResumeCompanyUpsertRequest(
    val id: Long? = null,
    val name: String,
    val startMonth: String,
    val endMonth: String? = null,
    val position: String? = null,
    val team: String? = null,
    val note: String? = null,
)

data class ResumeCategoryUpsertRequest(
    val id: Long? = null,
    val code: String,
    val label: String,
    val description: String? = null,
    val orderNo: Int = 0,
)

data class ResumeProjectUpsertRequest(
    val id: Long? = null,
    val title: String,
    val companyId: Long? = null,
    val categoryId: Long? = null,
    val startMonth: String? = null,
    val endMonth: String? = null,
    val summary: String? = null,
    val bodyMarkdown: String? = null,
    val metrics: List<String> = emptyList(),
    val skillIds: List<Long> = emptyList(),
    val detailSlug: String? = null,
    val orderNo: Int = 0,
    val published: Boolean = true,
)

data class ResumeSkillGroupUpsertRequest(
    val id: Long? = null,
    val label: String,
    val note: String? = null,
    val orderNo: Int = 0,
)

data class ResumeSkillUpsertRequest(
    val id: Long? = null,
    val name: String,
    val groupId: Long? = null,
    val orderNo: Int = 0,
)
