package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.TwoFactorSecretEntity
import org.springframework.data.jpa.repository.JpaRepository

interface TwoFactorSecretJpaRepository : JpaRepository<TwoFactorSecretEntity, Long>
