package com.kgd.codedictionary.application.portfolio.dto

import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeProject

/**
 * `/portfolio` 공개 아카이브 (ADR-0066 개정).
 *
 * 이력서와 **같은 데이터를 다른 범위로** 내보낸다. 프로젝트 내용은 공개하되
 * **어느 회사에서 한 일인지는 내보내지 않는다** — 그래서 회사 필드를 아예 두지 않았다.
 * 필드가 없으면 실수로 채울 자리도 없다.
 *
 * 상세 문서 slug 와 본문도 싣지 않는다. 상세는 게이트 뒤 resume 호스트에만 있어 공개면에서
 * 링크하면 404 로 끝나고, 본문에는 장애 대응의 구체적인 경위가 들어간다 — 요약과 지표까지가
 * 공개 범위다. DB 에는 그대로 남아 이력서(게이트 뒤)에서는 계속 보인다.
 */
data class PortfolioProjectsDto(
    val projects: List<PortfolioProjectDto>,
    val categories: List<PortfolioCategoryDto>,
)

data class PortfolioProjectDto(
    val title: String,
    val categoryCode: String?,
    val summary: String?,
    val metrics: List<String>,
    val tags: List<String>,
    val orderNo: Int,
) {
    companion object {
        fun from(
            project: ResumeProject,
            category: ResumeCategory?,
            tags: List<String>,
        ) = PortfolioProjectDto(
            title = project.title,
            categoryCode = category?.code,
            summary = project.summary,
            metrics = project.metrics,
            tags = tags,
            orderNo = project.orderNo,
        )
    }
}

data class PortfolioCategoryDto(
    val code: String,
    val label: String,
    val description: String?,
) {
    companion object {
        fun from(category: ResumeCategory) = PortfolioCategoryDto(
            code = category.code,
            label = category.label,
            description = category.description,
        )
    }
}
