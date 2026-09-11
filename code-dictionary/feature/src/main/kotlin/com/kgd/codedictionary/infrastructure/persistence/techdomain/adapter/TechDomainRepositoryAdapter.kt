package com.kgd.codedictionary.infrastructure.persistence.techdomain.adapter

import com.kgd.codedictionary.application.techdomain.port.TechDomainRepositoryPort
import com.kgd.codedictionary.domain.techdomain.model.TechDomain
import com.kgd.codedictionary.infrastructure.persistence.techdomain.repository.TechDomainJpaRepository
import org.springframework.stereotype.Component

@Component
class TechDomainRepositoryAdapter(
    private val jpaRepository: TechDomainJpaRepository,
) : TechDomainRepositoryPort {

    override fun findAllActiveOrdered(): List<TechDomain> =
        jpaRepository.findAllByActiveTrueOrderByOrderNoAsc().map { it.toDomain() }
}
