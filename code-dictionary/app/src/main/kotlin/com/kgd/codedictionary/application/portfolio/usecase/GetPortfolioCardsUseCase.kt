package com.kgd.codedictionary.application.portfolio.usecase

import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardDetailDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardSummaryDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioSort
import org.springframework.data.domain.Page

/** 포트폴리오 카드 목록·상세. */
interface GetPortfolioCardsUseCase {
    fun list(
        sort: PortfolioSort,
        stacks: List<String>,
        q: String?,
        page: Int,
        size: Int,
    ): Page<PortfolioCardSummaryDto>
    fun findById(id: Long): PortfolioCardDetailDto
}
