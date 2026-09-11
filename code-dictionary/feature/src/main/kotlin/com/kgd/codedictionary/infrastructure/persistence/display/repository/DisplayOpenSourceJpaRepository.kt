package com.kgd.codedictionary.infrastructure.persistence.display.repository

import com.kgd.codedictionary.infrastructure.persistence.display.entity.DisplayOpenSourceJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface DisplayOpenSourceJpaRepository : JpaRepository<DisplayOpenSourceJpaEntity, Long> {
    fun findAllByActiveTrueOrderByOrderNoAsc(): List<DisplayOpenSourceJpaEntity>
}
