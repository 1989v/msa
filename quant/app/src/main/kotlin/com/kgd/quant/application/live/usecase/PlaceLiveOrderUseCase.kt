package com.kgd.quant.application.live.usecase

import com.kgd.quant.application.exchange.port.OrderPlacement
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.live.SuspendReason
import java.math.BigDecimal

/**
 * Phase 3 7-stage 실주문 게이트 (ADR-0037 / TG-P3-26).
 *
 * live-mode → kill-switch 3단 → risk-limit 3단을 통과해야 거래소를 부른다.
 * 성공은 AuditChain(ORDER_PLACED) + LiveOrderRecord, 실패는 AuditChain(ORDER_REJECTED) + 예외.
 */
interface PlaceLiveOrderUseCase {
    suspend fun execute(input: Input): LiveOrderRecord

    data class Input(
        val tenantId: TenantId,
        val strategyId: StrategyId,
        val exchange: Exchange,
        val placement: OrderPlacement,
        val priceKrw: BigDecimal?,
    )

    class OrderRejectedByGate(message: String, val reason: SuspendReason) : RuntimeException(message)
}
