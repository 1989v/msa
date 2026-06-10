package com.kgd.codedictionary.application.portfolio.service

import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardDetailDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardSummaryDto
import com.kgd.codedictionary.application.portfolio.port.PortfolioCardRepositoryPort
import com.kgd.codedictionary.domain.portfolio.model.Visibility
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class PortfolioQueryService(
    private val repository: PortfolioCardRepositoryPort,
) {
    fun list(
        sort: PortfolioSort,
        stacks: List<String>,
        q: String?,
        page: Int,
        size: Int,
    ): Page<PortfolioCardSummaryDto> {
        val pageable = PageRequest.of(page, size, sort.toSpringSort())
        val raw = repository.search(Visibility.PUBLIC, q, pageable)

        val normalizedStacks = stacks.map { it.trim().lowercase() }.filter { it.isNotBlank() }
        if (normalizedStacks.isEmpty()) {
            return raw.map { PortfolioCardSummaryDto.from(it) }
        }

        val filtered = raw.content.filter { card ->
            val cardTagsLower = card.tags.map { it.lowercase() }.toSet()
            normalizedStacks.all { it in cardTagsLower }
        }.map { PortfolioCardSummaryDto.from(it) }

        return PageImpl(filtered, pageable, filtered.size.toLong())
    }

    fun findById(id: Long): PortfolioCardDetailDto {
        val card = repository.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "PortfolioCard not found: $id")
        if (card.visibility != Visibility.PUBLIC) {
            throw BusinessException(ErrorCode.NOT_FOUND, "PortfolioCard not found: $id")
        }
        return PortfolioCardDetailDto.from(card)
    }
}

enum class PortfolioSort {
    TIME,
    IMPACT;

    fun toSpringSort(): Sort = when (this) {
        TIME -> Sort.by(Sort.Direction.DESC, "createdAt")
        IMPACT -> Sort.by(Sort.Direction.DESC, "impact").and(Sort.by(Sort.Direction.DESC, "createdAt"))
    }

    companion object {
        fun parse(raw: String?): PortfolioSort = when (raw?.lowercase()) {
            null, "", "time" -> TIME
            "impact" -> IMPACT
            else -> throw BusinessException(ErrorCode.INVALID_INPUT, "Unknown sort: $raw")
        }
    }
}
