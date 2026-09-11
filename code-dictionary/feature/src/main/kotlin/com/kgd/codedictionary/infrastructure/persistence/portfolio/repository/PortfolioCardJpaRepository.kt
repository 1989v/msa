package com.kgd.codedictionary.infrastructure.persistence.portfolio.repository

import com.kgd.codedictionary.infrastructure.persistence.portfolio.entity.PortfolioCardJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface PortfolioCardJpaRepository : JpaRepository<PortfolioCardJpaEntity, Long>
