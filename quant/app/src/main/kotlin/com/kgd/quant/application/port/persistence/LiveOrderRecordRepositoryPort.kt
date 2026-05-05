package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.order.OrderStatus
import java.time.Duration

/**
 * LiveOrderRecordRepositoryPort — `live_order_record` 테이블 access (ADR-0037 / TG-P3-26).
 *
 * Phase 3 LIVE 전용 — Phase 2 페이퍼 OrderRepositoryPort 와 분리.
 */
interface LiveOrderRecordRepositoryPort {
    suspend fun save(record: LiveOrderRecord)
    suspend fun findById(id: OrderId): LiveOrderRecord?
    suspend fun lastAuditHash(tenantId: TenantId, strategyId: StrategyId): String?

    /** ReconcileJob 용 — status PENDING/SUBMITTED 인 주문 중 olderThan 보다 오래된 것. */
    suspend fun findPending(olderThan: Duration): List<LiveOrderRecord>

    suspend fun updateStatus(
        id: OrderId,
        newStatus: OrderStatus,
        filledAt: java.time.Instant? = null,
        cancelledAt: java.time.Instant? = null,
    )
}
