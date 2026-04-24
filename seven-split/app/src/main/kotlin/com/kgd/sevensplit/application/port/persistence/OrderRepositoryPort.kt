package com.kgd.sevensplit.application.port.persistence

import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.order.Order

/**
 * OrderRepositoryPort — `Order` 영속화 port.
 *
 * ## 계약
 * - 모든 조회 시그니처에 `tenantId` 포함 (INV-05).
 * - `save` 는 `orderId` 기반 upsert — 동일 id 2회 save 시 예외가 아닌 갱신 (INV-06 멱등성).
 * - `findBySlotId` 는 한 슬롯의 모든 주문(최신순). 슬롯 재사용(CLOSED→EMPTY) 이력 포함.
 */
interface OrderRepositoryPort {
    suspend fun save(order: Order): Order
    suspend fun findById(tenantId: TenantId, id: OrderId): Order?
    suspend fun findBySlotId(tenantId: TenantId, slotId: SlotId): List<Order>
}
