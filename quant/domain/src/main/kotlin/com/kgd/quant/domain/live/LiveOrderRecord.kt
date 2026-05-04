package com.kgd.quant.domain.live

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType
import java.math.BigDecimal
import java.time.Instant

/**
 * LiveOrderRecord — Phase 3 실주문 기록 (ADR-0037).
 *
 * Phase 2 의 페이퍼 OrderRecord 와 trade_mode 로 구분 (PAPER vs LIVE) — 본 도메인은 LIVE 전용.
 * audit chain hash 가 함께 저장되어 변조 검출 가능.
 */
data class LiveOrderRecord(
    val id: OrderId,
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val marketCode: MarketCode,
    val assetCode: AssetCode,
    val side: OrderSide,
    val type: SpotOrderType,
    val priceKrw: BigDecimal?,
    val quantity: BigDecimal,
    val status: OrderStatus,
    val exchangeOrderId: String?,
    val placedAt: Instant,
    val filledAt: Instant?,
    val cancelledAt: Instant?,
    val auditHashPrev: String?,
    val auditHashCurrent: String,
) {
    init {
        require(quantity > BigDecimal.ZERO) { "quantity must be > 0 (got $quantity)" }
        priceKrw?.let { require(it > BigDecimal.ZERO) { "priceKrw must be > 0 (got $it)" } }
        require(auditHashCurrent.length == 64) { "auditHashCurrent must be 64-char hex" }
        require(auditHashPrev == null || auditHashPrev.length == 64) { "auditHashPrev must be null or 64-char hex" }
        if (status == OrderStatus.FILLED) {
            require(filledAt != null) { "filledAt required when status=FILLED" }
        }
        if (status == OrderStatus.CANCELLED) {
            require(cancelledAt != null) { "cancelledAt required when status=CANCELLED" }
        }
    }
}
