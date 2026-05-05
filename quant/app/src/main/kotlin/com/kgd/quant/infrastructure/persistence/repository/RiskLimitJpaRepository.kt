package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.RiskLimitEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface RiskLimitJpaRepository : JpaRepository<RiskLimitEntity, UUID>
