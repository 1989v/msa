package com.kgd.sevensplit.infrastructure.persistence.mapper

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.SplitStrategyConfig
import com.kgd.sevensplit.domain.strategy.StrategyStatus
import com.kgd.sevensplit.infrastructure.persistence.entity.SplitStrategyEntity
import java.math.BigDecimal
import java.time.Instant

/**
 * TG-08.4: `SplitStrategy` ↔ `SplitStrategyEntity` 변환.
 *
 * ## 원칙
 * - 도메인 → 엔티티: `toEntity(domain, createdAt, updatedAt)` 로 시점 주입.
 * - 엔티티 → 도메인: `SplitStrategy.reconstruct(...)` 사용 (ADR-0022).
 * - `take_profit_per_round` 는 Jackson 을 이용해 `List<BigDecimal>` ↔ JSON 문자열 변환.
 *
 * ## 주의
 * - `object` singleton 이지만 ObjectMapper 는 주입받는다 (테스트 용이성).
 */
class SplitStrategyMapper(private val objectMapper: ObjectMapper) {

    fun toEntity(
        domain: SplitStrategy,
        createdAt: Instant,
        updatedAt: Instant
    ): SplitStrategyEntity {
        val takeProfits: List<BigDecimal> = domain.config.takeProfitPercentPerRound.map { it.value }
        return SplitStrategyEntity(
            strategyId = domain.id.value,
            tenantId = domain.tenantId.value,
            targetSymbol = domain.config.targetSymbol,
            roundCount = domain.config.roundCount,
            entryGapPercent = domain.config.entryGapPercent.value,
            takeProfitPerRoundJson = objectMapper.writeValueAsString(takeProfits),
            initialOrderAmount = domain.config.initialOrderAmount,
            executionMode = domain.executionMode.name,
            status = domain.status.name,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    /** 기존 엔티티 필드를 도메인 상태로 덮어쓴다 (update 경로). */
    fun applyToEntity(
        entity: SplitStrategyEntity,
        domain: SplitStrategy,
        updatedAt: Instant
    ): SplitStrategyEntity {
        entity.tenantId = domain.tenantId.value
        entity.targetSymbol = domain.config.targetSymbol
        entity.roundCount = domain.config.roundCount
        entity.entryGapPercent = domain.config.entryGapPercent.value
        entity.takeProfitPerRoundJson = objectMapper.writeValueAsString(
            domain.config.takeProfitPercentPerRound.map { it.value }
        )
        entity.initialOrderAmount = domain.config.initialOrderAmount
        entity.executionMode = domain.executionMode.name
        entity.status = domain.status.name
        entity.updatedAt = updatedAt
        return entity
    }

    fun toDomain(entity: SplitStrategyEntity): SplitStrategy {
        val takeProfitValues: List<BigDecimal> = objectMapper.readValue(
            entity.takeProfitPerRoundJson,
            object : TypeReference<List<BigDecimal>>() {}
        )
        val config = SplitStrategyConfig(
            roundCount = entity.roundCount,
            entryGapPercent = Percent(entity.entryGapPercent),
            takeProfitPercentPerRound = takeProfitValues.map { Percent(it) },
            initialOrderAmount = entity.initialOrderAmount,
            targetSymbol = entity.targetSymbol
        )
        return SplitStrategy.reconstruct(
            id = StrategyId(entity.strategyId),
            tenantId = TenantId(entity.tenantId),
            config = config,
            executionMode = ExecutionMode.valueOf(entity.executionMode),
            status = StrategyStatus.valueOf(entity.status)
        )
    }
}
