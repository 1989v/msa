package com.kgd.sevensplit.domain.event

import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import com.kgd.sevensplit.domain.order.OrderSide
import com.kgd.sevensplit.domain.order.SpotOrderType
import com.kgd.sevensplit.domain.strategy.EndReason
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * Domain Event sealed 계층.
 *
 * 모든 도메인 이벤트는 이 계층에 속한다 (Acceptance Criteria).
 * Application 레이어가 Outbox 패턴으로 Kafka 에 발행한다.
 */
sealed class DomainEvent {
    abstract val eventId: UUID
    abstract val occurredAt: Instant
    abstract val tenantId: TenantId
}

// ------------------------------ Strategy events ------------------------------

data class StrategyActivated(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val strategyId: StrategyId
) : DomainEvent()

data class StrategyPaused(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val strategyId: StrategyId
) : DomainEvent()

data class StrategyResumed(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val strategyId: StrategyId
) : DomainEvent()

data class StrategyLiquidated(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val strategyId: StrategyId,
    val reason: EndReason
) : DomainEvent()

// ------------------------------ Slot events ----------------------------------

data class RoundSlotOpened(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val slotId: SlotId,
    val roundIndex: Int,
    val entryPrice: Price
) : DomainEvent()

data class RoundSlotClosed(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val slotId: SlotId,
    val pnl: BigDecimal
) : DomainEvent()

// ------------------------------ Order events ---------------------------------

data class OrderPlaced(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val orderId: OrderId,
    val slotId: SlotId,
    val side: OrderSide,
    val type: SpotOrderType,
    val quantity: Quantity,
    val price: Price?
) : DomainEvent()

data class OrderFilled(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val orderId: OrderId,
    val executedPrice: Price,
    val executedQty: Quantity
) : DomainEvent()

data class OrderPartiallyFilled(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val orderId: OrderId,
    val cumulativeFilled: Quantity,
    val remaining: Quantity
) : DomainEvent()

data class OrderFailed(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val orderId: OrderId,
    val reason: String
) : DomainEvent()

data class OrderCancelled(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val orderId: OrderId
) : DomainEvent()

// ------------------------------ Risk events ----------------------------------

data class RiskLimitBreached(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val limitType: String,
    val value: BigDecimal
) : DomainEvent()

data class EmergencyLiquidationTriggered(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val reason: String
) : DomainEvent()

// ------------------------------ Exchange events ------------------------------

data class ExchangeConnectionDegraded(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val exchange: Exchange,
    val reason: String
) : DomainEvent()

data class ExchangeConnectionRestored(
    override val eventId: UUID = UUID.randomUUID(),
    override val occurredAt: Instant = Instant.now(),
    override val tenantId: TenantId,
    val exchange: Exchange
) : DomainEvent()
