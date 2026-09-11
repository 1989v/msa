package com.kgd.codedictionary.infrastructure.persistence.techdomain.repository

import com.kgd.codedictionary.infrastructure.persistence.techdomain.entity.TechDomainJpaEntity
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository

interface TechDomainJpaRepository : JpaRepository<TechDomainJpaEntity, Long> {
    @EntityGraph(attributePaths = ["concepts"])
    fun findAllByActiveTrueOrderByOrderNoAsc(): List<TechDomainJpaEntity>
}
