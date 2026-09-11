package com.kgd.codedictionary.infrastructure.persistence.display.repository

import com.kgd.codedictionary.domain.display.model.DisplayStatus
import com.kgd.codedictionary.infrastructure.persistence.display.entity.DisplayServiceJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface DisplayServiceJpaRepository : JpaRepository<DisplayServiceJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<DisplayServiceJpaEntity>
    fun findAllByStatusNotOrderByOrderNoAsc(status: DisplayStatus): List<DisplayServiceJpaEntity>
    fun findByCode(code: String): DisplayServiceJpaEntity?
}
