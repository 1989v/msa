package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType
import com.kgd.quant.infrastructure.persistence.adapter.RiskLimitJpaAdapter.Companion.toUuid
import com.kgd.quant.infrastructure.persistence.entity.LiveOrderRecordEntity
import com.kgd.quant.infrastructure.persistence.repository.LiveOrderRecordJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant
import kotlin.jvm.optionals.getOrNull

/**
 * TG-P3-26 — LiveOrderRecord JPA 어댑터 (ADR-0037, Phase 3 LIVE 전용).
 */
@Component
class LiveOrderRecordJpaAdapter(
    private val repo: LiveOrderRecordJpaRepository,
) : LiveOrderRecordRepositoryPort {

    override suspend fun save(record: LiveOrderRecord) = withContext(Dispatchers.IO) {
        val entity = repo.findById(record.id.value).orElseGet { LiveOrderRecordEntity(id = record.id.value) }
        entity.tenantId = record.tenantId.toUuid()
        entity.strategyId = record.strategyId.value
        entity.marketCode = record.marketCode.value
        entity.assetCode = record.assetCode.value
        entity.side = record.side.name
        entity.type = record.type.serializedName()
        entity.priceKrw = record.priceKrw
        entity.quantity = record.quantity
        entity.status = record.status.name
        entity.exchangeOrderId = record.exchangeOrderId
        entity.placedAt = record.placedAt
        entity.filledAt = record.filledAt
        entity.cancelledAt = record.cancelledAt
        entity.auditHashPrev = record.auditHashPrev
        entity.auditHashCurrent = record.auditHashCurrent
        repo.save(entity)
        Unit
    }

    override suspend fun findById(id: OrderId): LiveOrderRecord? = withContext(Dispatchers.IO) {
        repo.findById(id.value).getOrNull()?.toDomain()
    }

    override suspend fun lastAuditHash(tenantId: TenantId, strategyId: StrategyId): String? =
        withContext(Dispatchers.IO) {
            repo.findFirstByTenantIdAndStrategyIdOrderByPlacedAtDesc(
                tenantId.toUuid(),
                strategyId.value,
            )?.auditHashCurrent
        }

    override suspend fun findPending(olderThan: Duration): List<LiveOrderRecord> = withContext(Dispatchers.IO) {
        repo.findByStatusInAndPlacedAtBefore(
            statuses = listOf(OrderStatus.SUBMITTED.name, OrderStatus.PARTIALLY_FILLED.name),
            before = Instant.now().minus(olderThan),
        ).map { it.toDomain() }
    }

    override suspend fun updateStatus(
        id: OrderId,
        newStatus: OrderStatus,
        filledAt: Instant?,
        cancelledAt: Instant?,
    ) = withContext(Dispatchers.IO) {
        val entity = repo.findById(id.value).orElseThrow {
            IllegalArgumentException("LiveOrderRecord not found: $id")
        }
        entity.status = newStatus.name
        if (filledAt != null) entity.filledAt = filledAt
        if (cancelledAt != null) entity.cancelledAt = cancelledAt
        repo.save(entity)
        Unit
    }

    private fun LiveOrderRecordEntity.toDomain(): LiveOrderRecord = LiveOrderRecord(
        id = OrderId(id),
        tenantId = TenantId(tenantId.toString()),
        strategyId = StrategyId(strategyId),
        marketCode = MarketCode(marketCode),
        assetCode = AssetCode(assetCode),
        side = OrderSide.valueOf(side),
        type = parseOrderType(type, priceKrw),
        priceKrw = priceKrw,
        quantity = quantity,
        status = OrderStatus.valueOf(status),
        exchangeOrderId = exchangeOrderId,
        placedAt = placedAt,
        filledAt = filledAt,
        cancelledAt = cancelledAt,
        auditHashPrev = auditHashPrev,
        auditHashCurrent = auditHashCurrent,
    )

    /** SpotOrderType sealed → simpleName ("Market" / "Limit") 직렬화. */
    private fun SpotOrderType.serializedName(): String = when (this) {
        is SpotOrderType.Market -> "Market"
        is SpotOrderType.Limit -> "Limit"
    }

    private fun parseOrderType(name: String, priceKrw: java.math.BigDecimal?): SpotOrderType =
        if (name == "Limit" && priceKrw != null && priceKrw > java.math.BigDecimal.ZERO) {
            SpotOrderType.Limit(Price(priceKrw))
        } else SpotOrderType.Market
}
