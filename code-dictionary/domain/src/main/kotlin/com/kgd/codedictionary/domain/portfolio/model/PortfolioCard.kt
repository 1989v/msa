package com.kgd.codedictionary.domain.portfolio.model

import java.time.LocalDate
import java.time.LocalDateTime

class PortfolioCard private constructor(
    val id: Long? = null,
    val title: String,
    val summary: String?,
    val body: String,
    val periodStart: LocalDate?,
    val periodEnd: LocalDate?,
    val role: String?,
    val impact: Int,
    val visibility: Visibility,
    val tags: List<String>,
    val keywords: List<String>,
    val createdAt: LocalDateTime? = null,
    val updatedAt: LocalDateTime? = null,
) {
    companion object {
        const val IMPACT_MIN = 1
        const val IMPACT_MAX = 10

        fun create(
            title: String,
            body: String,
            summary: String? = null,
            periodStart: LocalDate? = null,
            periodEnd: LocalDate? = null,
            role: String? = null,
            impact: Int = 5,
            visibility: Visibility = Visibility.PUBLIC,
            tags: List<String> = emptyList(),
            keywords: List<String> = emptyList(),
        ): PortfolioCard {
            require(title.isNotBlank()) { "title은 비어있을 수 없습니다" }
            require(body.isNotBlank()) { "body는 비어있을 수 없습니다" }
            require(impact in IMPACT_MIN..IMPACT_MAX) { "impact는 $IMPACT_MIN~$IMPACT_MAX 범위여야 합니다" }
            if (periodStart != null && periodEnd != null) {
                require(!periodEnd.isBefore(periodStart)) { "periodEnd가 periodStart보다 이전일 수 없습니다" }
            }
            return PortfolioCard(
                title = title.trim(),
                summary = summary?.trim(),
                body = body,
                periodStart = periodStart,
                periodEnd = periodEnd,
                role = role?.trim(),
                impact = impact,
                visibility = visibility,
                tags = tags.map { it.trim() }.filter { it.isNotBlank() },
                keywords = keywords.map { it.trim() }.filter { it.isNotBlank() },
            )
        }

        fun restore(
            id: Long?,
            title: String,
            summary: String?,
            body: String,
            periodStart: LocalDate?,
            periodEnd: LocalDate?,
            role: String?,
            impact: Int,
            visibility: Visibility,
            tags: List<String>,
            keywords: List<String>,
            createdAt: LocalDateTime?,
            updatedAt: LocalDateTime?,
        ): PortfolioCard = PortfolioCard(
            id = id,
            title = title,
            summary = summary,
            body = body,
            periodStart = periodStart,
            periodEnd = periodEnd,
            role = role,
            impact = impact,
            visibility = visibility,
            tags = tags,
            keywords = keywords,
            createdAt = createdAt,
            updatedAt = updatedAt,
        )
    }
}
