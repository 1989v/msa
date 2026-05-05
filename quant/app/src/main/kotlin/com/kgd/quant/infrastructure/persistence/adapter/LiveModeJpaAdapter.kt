package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.LiveModeRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.LiveTradingMode
import com.kgd.quant.domain.live.SuspendReason
import com.kgd.quant.infrastructure.persistence.adapter.RiskLimitJpaAdapter.Companion.toUuid
import com.kgd.quant.infrastructure.persistence.entity.LiveTradingStateEntity
import com.kgd.quant.infrastructure.persistence.repository.LiveTradingStateJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component
import java.time.Instant
import kotlin.jvm.optionals.getOrNull

/**
 * TG-P3-04 — LiveTradingMode JPA 어댑터 (ADR-0037).
 *
 * 부재 (row 없음) = `Disabled` 로 해석.
 */
@Component
class LiveModeJpaAdapter(
    private val repo: LiveTradingStateJpaRepository,
) : LiveModeRepositoryPort {

    override suspend fun findByTenantId(tenantId: TenantId): LiveTradingMode = withContext(Dispatchers.IO) {
        val uuid = tenantId.toUuid()
        repo.findById(uuid).getOrNull()?.toDomain(tenantId) ?: LiveTradingMode.Disabled(tenantId)
    }

    override suspend fun save(state: LiveTradingMode) = withContext(Dispatchers.IO) {
        val uuid = state.tenantId.toUuid()
        val entity = repo.findById(uuid).orElseGet { LiveTradingStateEntity(tenantId = uuid) }
        when (state) {
            is LiveTradingMode.Disabled -> {
                entity.mode = "DISABLED"
                entity.activatedAt = null
                entity.activatedBy = null
                entity.suspendReason = null
                entity.suspendedAt = null
                entity.twoFaTokenHash = null
            }
            is LiveTradingMode.Enabled -> {
                entity.mode = "ENABLED"
                entity.activatedAt = state.activatedAt
                entity.suspendReason = null
                entity.suspendedAt = null
                entity.twoFaTokenHash = state.twoFaTokenHash
            }
            is LiveTradingMode.Suspended -> {
                entity.mode = "SUSPENDED"
                entity.suspendReason = state.reason.name
                entity.suspendedAt = state.suspendedAt
            }
        }
        entity.updatedAt = Instant.now()
        repo.save(entity)
        Unit
    }

    private fun LiveTradingStateEntity.toDomain(tenantId: TenantId): LiveTradingMode = when (mode) {
        "ENABLED" -> LiveTradingMode.Enabled(
            tenantId = tenantId,
            activatedAt = activatedAt ?: Instant.EPOCH,
            twoFaTokenHash = twoFaTokenHash ?: "0".repeat(64),
        )
        "SUSPENDED" -> LiveTradingMode.Suspended(
            tenantId = tenantId,
            reason = suspendReason?.let { runCatching { SuspendReason.valueOf(it) }.getOrNull() }
                ?: SuspendReason.USER_KILL_SWITCH,
            suspendedAt = suspendedAt ?: Instant.EPOCH,
        )
        else -> LiveTradingMode.Disabled(tenantId)
    }
}
