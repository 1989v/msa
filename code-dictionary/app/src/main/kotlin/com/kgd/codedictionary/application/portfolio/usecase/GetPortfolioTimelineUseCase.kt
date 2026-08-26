package com.kgd.codedictionary.application.portfolio.usecase

import com.kgd.codedictionary.application.portfolio.dto.PortfolioTimelineDto

/** 포트폴리오 타임라인. */
interface GetPortfolioTimelineUseCase {
    fun timeline(): PortfolioTimelineDto
}
