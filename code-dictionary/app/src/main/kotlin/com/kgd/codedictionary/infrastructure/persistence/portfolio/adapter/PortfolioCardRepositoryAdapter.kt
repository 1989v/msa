package com.kgd.codedictionary.infrastructure.persistence.portfolio.adapter

import com.kgd.codedictionary.application.portfolio.port.PortfolioCardRepositoryPort
import com.kgd.codedictionary.domain.portfolio.model.PortfolioCard
import com.kgd.codedictionary.domain.portfolio.model.Visibility
import com.kgd.codedictionary.infrastructure.persistence.portfolio.entity.PortfolioCardJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.portfolio.repository.PortfolioCardJpaRepository
import com.kgd.codedictionary.infrastructure.persistence.portfolio.repository.PortfolioCardQueryRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
class PortfolioCardRepositoryAdapter(
    private val jpaRepository: PortfolioCardJpaRepository,
    private val queryRepository: PortfolioCardQueryRepository,
) : PortfolioCardRepositoryPort {

    override fun save(card: PortfolioCard): PortfolioCard {
        val id = card.id
        val entity = if (id != null) {
            jpaRepository.findById(id).orElseThrow {
                IllegalArgumentException("PortfolioCard not found: $id")
            }.apply { update(card) }
        } else {
            PortfolioCardJpaEntity.fromDomain(card)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): PortfolioCard? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun search(visibility: Visibility, q: String?, pageable: Pageable): Page<PortfolioCard> =
        queryRepository.search(visibility, q, pageable).map { it.toDomain() }
}
