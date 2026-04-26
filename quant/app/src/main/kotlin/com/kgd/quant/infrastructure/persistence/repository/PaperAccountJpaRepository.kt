package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.PaperAccountEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

/**
 * TG-P2-08: `paper_account` JpaRepository.
 *
 * (tenantId, strategyId, baseAsset) 조합 unique. 기본 baseAsset = KRW.
 */
interface PaperAccountJpaRepository : JpaRepository<PaperAccountEntity, Long> {

    fun findByTenantIdAndStrategyIdAndBaseAsset(
        tenantId: String,
        strategyId: UUID,
        baseAsset: String
    ): PaperAccountEntity?
}
