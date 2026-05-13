package com.kgd.codedictionary.infrastructure.persistence.service.repository

import com.kgd.codedictionary.infrastructure.persistence.service.entity.ServiceJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ServiceJpaRepository : JpaRepository<ServiceJpaEntity, Long> {
    fun findAllByOrderByDisplayOrderAsc(): List<ServiceJpaEntity>
    fun findAllByIsPrivateFalseOrderByDisplayOrderAsc(): List<ServiceJpaEntity>
}
