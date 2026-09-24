package com.kgd.ads.infrastructure.persistence.audit.repository

import com.kgd.ads.infrastructure.persistence.audit.entity.AdminActionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AdminActionJpaRepository : JpaRepository<AdminActionJpaEntity, Long>
