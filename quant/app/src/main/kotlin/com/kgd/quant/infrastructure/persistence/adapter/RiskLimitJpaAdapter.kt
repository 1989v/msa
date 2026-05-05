package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.RiskLimitRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.RiskLimit
import com.kgd.quant.infrastructure.persistence.entity.RiskLimitEntity
import com.kgd.quant.infrastructure.persistence.repository.RiskLimitJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

/**
 * TG-P3-14 — RiskLimit JPA 어댑터 (ADR-0037).
 *
 * TenantId(String) ↔ BINARY(16) UUID 변환 — 도메인이 opaque String 이지만 DB는 UUID 형식 강제.
 * 변환 실패 시 IllegalArgumentException — 운영자가 형식을 맞춰야 함.
 */
@Component
class RiskLimitJpaAdapter(
    private val repo: RiskLimitJpaRepository,
) : RiskLimitRepositoryPort {

    override suspend fun findByTenantId(tenantId: TenantId): RiskLimit? = withContext(Dispatchers.IO) {
        repo.findById(tenantId.toUuid()).getOrNull()?.toDomain(tenantId)
    }

    override suspend fun save(limit: RiskLimit) = withContext(Dispatchers.IO) {
        val uuid = limit.tenantId.toUuid()
        val entity = repo.findById(uuid).orElseGet { RiskLimitEntity(tenantId = uuid) }
        entity.dailyLossLimitKrw = limit.dailyLossLimitKrw
        entity.dailyVolumeLimitKrw = limit.dailyVolumeLimitKrw
        entity.singleOrderMaxKrw = limit.singleOrderMaxKrw
        entity.updatedAt = limit.updatedAt
        entity.updatedBy = limit.updatedBy
        repo.save(entity)
        Unit
    }

    private fun RiskLimitEntity.toDomain(tenantId: TenantId): RiskLimit = RiskLimit(
        tenantId = tenantId,
        dailyLossLimitKrw = dailyLossLimitKrw,
        dailyVolumeLimitKrw = dailyVolumeLimitKrw,
        singleOrderMaxKrw = singleOrderMaxKrw,
        updatedAt = updatedAt,
        updatedBy = updatedBy,
    )

    companion object {
        fun TenantId.toUuid(): UUID = runCatching { UUID.fromString(value) }
            .getOrElse { throw IllegalArgumentException("TenantId must be UUID format for live trading: $value") }
    }
}
