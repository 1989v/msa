package com.kgd.ads.infrastructure.persistence.category.repository

import com.kgd.ads.infrastructure.persistence.category.entity.ContextMappingJpaEntity
import com.kgd.ads.infrastructure.persistence.category.entity.HostCategoryJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ContextMappingJpaRepository : JpaRepository<ContextMappingJpaEntity, String>

interface HostCategoryJpaRepository : JpaRepository<HostCategoryJpaEntity, String>
