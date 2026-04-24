package com.kgd.sevensplit.infrastructure.persistence.adapter

import com.kgd.sevensplit.application.port.persistence.OrderRepositoryPort
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.order.Order
import com.kgd.sevensplit.infrastructure.persistence.mapper.OrderMapper
import com.kgd.sevensplit.infrastructure.persistence.repository.OrderJpaRepository
import com.kgd.sevensplit.infrastructure.persistence.repository.RoundSlotJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

/**
 * TG-08.5: `OrderRepositoryPort` 의 JPA 기반 구현.
 *
 * ## tenantId 규칙 (INV-05)
 * 도메인 `Order` 는 `tenantId` 필드를 가지지 않는다. port `save(order)` 는 slot 에서 tenantId 를 상속:
 *  1) 기존 `order` row 가 있으면 보존.
 *  2) 없으면 `round_slot.tenant_id` 조회 → 상속.
 *  3) 그래도 없으면 [IllegalStateException].
 *
 * INV-06 멱등성: `save` 는 `orderId` upsert — 동일 id 2회 호출 시 도메인 필드만 갱신 (예외 아님).
 */
@Component
class JpaOrderRepositoryAdapter(
    private val jpa: OrderJpaRepository,
    private val slotJpa: RoundSlotJpaRepository,
    private val clock: Clock
) : OrderRepositoryPort {

    override suspend fun save(order: Order): Order = withContext(Dispatchers.IO) {
        val now = clock.now()
        val existing = jpa.findById(order.orderId.value).orElse(null)
        val tenantId: TenantId = if (existing != null) {
            TenantId(existing.tenantId)
        } else {
            val slot = slotJpa.findById(order.slotId.value).orElse(null)
                ?: throw IllegalStateException(
                    "Order cannot be persisted before its parent RoundSlot (slotId=${order.slotId.value})"
                )
            TenantId(slot.tenantId)
        }
        val entity = if (existing == null) {
            OrderMapper.toEntity(order, tenantId, createdAt = now, updatedAt = now)
        } else {
            OrderMapper.applyToEntity(existing, order, tenantId, updatedAt = now)
        }
        OrderMapper.toDomain(jpa.save(entity))
    }

    override suspend fun findById(tenantId: TenantId, id: OrderId): Order? =
        withContext(Dispatchers.IO) {
            jpa.findByOrderIdAndTenantId(id.value, tenantId.value)
                ?.let { OrderMapper.toDomain(it) }
        }

    override suspend fun findBySlotId(tenantId: TenantId, slotId: SlotId): List<Order> =
        withContext(Dispatchers.IO) {
            jpa.findAllBySlotIdAndTenantIdOrderByCreatedAtDesc(slotId.value, tenantId.value)
                .map { OrderMapper.toDomain(it) }
        }
}
