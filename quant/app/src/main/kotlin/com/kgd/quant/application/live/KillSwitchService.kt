package com.kgd.quant.application.live

import com.kgd.quant.application.port.persistence.KillSwitchRepositoryPort
import com.kgd.quant.application.port.state.KillSwitchStatePort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.KillSwitch
import com.kgd.quant.domain.live.KillSwitchSnapshot
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * KillSwitchService — 3-레벨 비상 정지 (ADR-0037 / TG-P3-13 ~ TG-P3-18).
 *
 * 토글 흐름:
 * 1. Redis SET (저지연 ≤200ms reflect)
 * 2. MySQL append (감사)
 * 3. AuditEvent (chain) 발급 — 별도 AuditChainService 로 위임 (J5+ 후속)
 *
 * 해제(enabled=false) 는 사용자 명시 액션 + 2FA 검증 토큰 redeem 후 호출.
 * 자동 trigger (RiskLimit breach 등) 도 본 서비스를 호출.
 */
@Service
class KillSwitchService(
    private val state: KillSwitchStatePort,
    private val repo: KillSwitchRepositoryPort,
) {
    suspend fun toggleGlobal(
        enabled: Boolean,
        actorId: Long,
        reason: String?,
        at: Instant = Instant.now(),
    ) {
        state.setGlobal(enabled)
        repo.append(KillSwitch.Global(enabled, at, actorId, reason))
        log.warn { "kill-switch GLOBAL → enabled=$enabled actor=$actorId reason=$reason" }
    }

    suspend fun toggleTenant(
        tenantId: TenantId,
        enabled: Boolean,
        actorId: Long,
        reason: String?,
        at: Instant = Instant.now(),
    ) {
        state.setTenant(tenantId, enabled)
        repo.append(KillSwitch.Tenant(tenantId, enabled, at, actorId, reason))
        log.info { "kill-switch TENANT $tenantId → enabled=$enabled actor=$actorId reason=$reason" }
    }

    suspend fun toggleStrategy(
        strategyId: StrategyId,
        enabled: Boolean,
        actorId: Long,
        reason: String?,
        at: Instant = Instant.now(),
    ) {
        state.setStrategy(strategyId, enabled)
        repo.append(KillSwitch.Strategy(strategyId, enabled, at, actorId, reason))
        log.info { "kill-switch STRATEGY $strategyId → enabled=$enabled actor=$actorId reason=$reason" }
    }

    suspend fun snapshot(tenantId: TenantId, strategyId: StrategyId): KillSwitchSnapshot =
        state.snapshot(tenantId, strategyId)
}
