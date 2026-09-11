package com.kgd.codedictionary.application.portfolio.dto

import com.kgd.codedictionary.domain.portfolio.model.PortfolioCard
import com.kgd.codedictionary.domain.portfolio.model.Visibility
import java.time.LocalDate
import java.time.LocalDateTime

data class PortfolioCardSummaryDto(
    val id: Long,
    val title: String,
    val summary: String?,
    val periodStart: LocalDate?,
    val periodEnd: LocalDate?,
    val role: String?,
    val impact: Int,
    val tags: List<String>,
    val createdAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
) {
    companion object {
        fun from(card: PortfolioCard): PortfolioCardSummaryDto = PortfolioCardSummaryDto(
            id = requireNotNull(card.id) { "Persisted card must have id" },
            title = card.title,
            summary = card.summary,
            periodStart = card.periodStart,
            periodEnd = card.periodEnd,
            role = card.role,
            impact = card.impact,
            tags = card.tags,
            createdAt = card.createdAt,
            updatedAt = card.updatedAt,
        )
    }
}

data class PortfolioCardDetailDto(
    val id: Long,
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
    val createdAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
) {
    companion object {
        fun from(card: PortfolioCard): PortfolioCardDetailDto = PortfolioCardDetailDto(
            id = requireNotNull(card.id) { "Persisted card must have id" },
            title = card.title,
            summary = card.summary,
            body = card.body,
            periodStart = card.periodStart,
            periodEnd = card.periodEnd,
            role = card.role,
            impact = card.impact,
            visibility = card.visibility,
            tags = card.tags,
            keywords = card.keywords,
            createdAt = card.createdAt,
            updatedAt = card.updatedAt,
        )
    }
}
