package com.kgd.codedictionary.application.portfolio.port

import com.kgd.codedictionary.domain.portfolio.model.PortfolioCard
import com.kgd.codedictionary.domain.portfolio.model.Visibility
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface PortfolioCardRepositoryPort {
    fun save(card: PortfolioCard): PortfolioCard
    fun findById(id: Long): PortfolioCard?
    fun search(visibility: Visibility, q: String?, pageable: Pageable): Page<PortfolioCard>
}
