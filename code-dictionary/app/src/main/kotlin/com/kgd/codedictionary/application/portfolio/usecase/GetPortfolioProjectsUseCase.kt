package com.kgd.codedictionary.application.portfolio.usecase

import com.kgd.codedictionary.application.portfolio.dto.PortfolioProjectsDto

/** 포트폴리오 프로젝트 묶음. 잠금 해제 여부로 코드 스니펫 노출이 갈린다. */
interface GetPortfolioProjectsUseCase {
    fun projects(unlocked: Boolean = false): PortfolioProjectsDto
}
