package com.kgd.quant.infrastructure.persistence.adapter

import tools.jackson.databind.ObjectMapper
import com.kgd.quant.application.strategy.port.SignalStrategyRepositoryPort
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.strategy.SignalStrategy
import com.kgd.quant.infrastructure.persistence.entity.SignalStrategyEntity
import com.kgd.quant.infrastructure.persistence.repository.SignalStrategyJpaRepository
import com.kgd.quant.infrastructure.persistence.payload.PositionSizingPayload
import com.kgd.quant.infrastructure.persistence.payload.SignalConfigPayload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Component

/**
 * JpaSignalStrategyAdapter — `SignalStrategyRepositoryPort` JPA 정식 구현 (ADR-0033 Phase 1 후반).
 *
 * SignalConfig / PositionSizing 은 polymorphic DTO 를 통해 JSON 컬럼에 직렬화/역직렬화.
 * `@Primary` 로 in-memory stub adapter 를 우선한다.
 *
 * INV-05 (tenantId 격리) — 모든 read 시그니처에 tenantId 포함.
 */
@Component
@Primary
class JpaSignalStrategyAdapter(
    private val jpa: SignalStrategyJpaRepository,
    private val objectMapper: ObjectMapper,
) : SignalStrategyRepositoryPort {

    override suspend fun save(strategy: SignalStrategy): SignalStrategy = withContext(Dispatchers.IO) {
        val entity = SignalStrategyEntity(
            strategyId = strategy.id.value,
            tenantId = strategy.tenantId.value,
            assetCode = strategy.asset.code.value,
            assetClass = strategy.asset.assetClass.name,
            marketCode = strategy.market.code.value,
            entrySignalJson = objectMapper.writeValueAsString(SignalConfigPayload.from(strategy.entrySignal)),
            exitSignalJson = strategy.exitSignal?.let { objectMapper.writeValueAsString(SignalConfigPayload.from(it)) },
            sizingJson = objectMapper.writeValueAsString(PositionSizingPayload.from(strategy.sizing)),
            createdAt = strategy.createdAt,
        )
        jpa.save(entity)
        strategy
    }

    override suspend fun findById(tenantId: TenantId, id: StrategyId): SignalStrategy? =
        withContext(Dispatchers.IO) {
            jpa.findByStrategyIdAndTenantId(id.value, tenantId.value)?.toDomain()
        }

    override suspend fun findAll(tenantId: TenantId): List<SignalStrategy> =
        withContext(Dispatchers.IO) {
            jpa.findAllByTenantIdOrderByCreatedAtDesc(tenantId.value).map { it.toDomain() }
        }

    override suspend fun delete(tenantId: TenantId, id: StrategyId) {
        withContext(Dispatchers.IO) {
            jpa.deleteByStrategyIdAndTenantId(id.value, tenantId.value)
        }
    }

    private fun SignalStrategyEntity.toDomain(): SignalStrategy {
        val assetClass = AssetClass.valueOf(assetClass)
        val asset = Asset(
            code = AssetCode(assetCode),
            assetClass = assetClass,
            displayName = assetCode,                   // FE 가 별도 카탈로그에서 풍부화
        )
        val market = Market(
            code = MarketCode(marketCode),
            supportedClasses = setOf(assetClass),
            displayName = marketCode,
        )
        return SignalStrategy(
            id = StrategyId(strategyId),
            tenantId = TenantId(tenantId),
            asset = asset,
            market = market,
            entrySignal = objectMapper.readValue(entrySignalJson, SignalConfigPayload::class.java).toDomain(),
            exitSignal = exitSignalJson?.let {
                objectMapper.readValue(it, SignalConfigPayload::class.java).toDomain()
            },
            sizing = objectMapper.readValue(sizingJson, PositionSizingPayload::class.java).toDomain(),
            createdAt = createdAt,
        )
    }
}
