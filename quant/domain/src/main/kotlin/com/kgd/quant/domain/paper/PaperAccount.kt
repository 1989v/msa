package com.kgd.quant.domain.paper

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import java.math.BigDecimal
import java.time.Instant

/**
 * 페이퍼 트레이딩 가상 잔고 (TG-P2-08).
 *
 * ExchangeCredential 의 실거래소 잔고와 격리된 가상 잔고다 (INV-P2-09). PAPER 모드 전용.
 * 보유 수량은 TrancheSlot.filledQty 가 추적하므로 여기는 [balance] 만 갖는다.
 */
data class PaperAccount(
    val id: Long = 0,
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val baseAsset: String = "KRW",
    val balance: BigDecimal,
    val createdAt: Instant,
    val updatedAt: Instant,
)
