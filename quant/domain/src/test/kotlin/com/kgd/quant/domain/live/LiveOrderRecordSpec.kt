package com.kgd.quant.domain.live

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import java.math.BigDecimal
import java.time.Instant

/**
 * LiveOrderRecordSpec — Phase 3 LIVE order invariant (L8).
 */
class LiveOrderRecordSpec : BehaviorSpec({
    val tenantId = TenantId("33333333-3333-3333-3333-333333333333")
    val orderId = OrderId.newV7()
    val strategyId = StrategyId.newId()
    val now = Instant.parse("2026-05-05T00:00:00Z")
    val sha = "a".repeat(64)

    given("LiveOrderRecord") {
        `when`("quantity = 0") {
            then("require 실패") {
                shouldThrow<IllegalArgumentException> {
                    LiveOrderRecord(
                        id = orderId,
                        tenantId = tenantId,
                        strategyId = strategyId,
                        marketCode = MarketCode("BITHUMB"),
                        assetCode = AssetCode("BTC"),
                        side = OrderSide.BUY,
                        type = SpotOrderType.Market,
                        priceKrw = null,
                        quantity = BigDecimal.ZERO,
                        status = OrderStatus.SUBMITTED,
                        exchangeOrderId = "ex-1",
                        placedAt = now,
                        filledAt = null,
                        cancelledAt = null,
                        auditHashPrev = null,
                        auditHashCurrent = sha,
                    )
                }
            }
        }

        `when`("status=FILLED 인데 filledAt null") {
            then("require 실패") {
                shouldThrow<IllegalArgumentException> {
                    LiveOrderRecord(
                        id = orderId,
                        tenantId = tenantId,
                        strategyId = strategyId,
                        marketCode = MarketCode("BITHUMB"),
                        assetCode = AssetCode("BTC"),
                        side = OrderSide.BUY,
                        type = SpotOrderType.Market,
                        priceKrw = null,
                        quantity = BigDecimal("0.01"),
                        status = OrderStatus.FILLED,
                        exchangeOrderId = "ex-1",
                        placedAt = now,
                        filledAt = null,
                        cancelledAt = null,
                        auditHashPrev = null,
                        auditHashCurrent = sha,
                    )
                }
            }
        }

        `when`("auditHashCurrent 길이가 64 가 아니면") {
            then("require 실패") {
                shouldThrow<IllegalArgumentException> {
                    LiveOrderRecord(
                        id = orderId,
                        tenantId = tenantId,
                        strategyId = strategyId,
                        marketCode = MarketCode("BITHUMB"),
                        assetCode = AssetCode("BTC"),
                        side = OrderSide.BUY,
                        type = SpotOrderType.Market,
                        priceKrw = null,
                        quantity = BigDecimal("0.01"),
                        status = OrderStatus.SUBMITTED,
                        exchangeOrderId = "ex-1",
                        placedAt = now,
                        filledAt = null,
                        cancelledAt = null,
                        auditHashPrev = null,
                        auditHashCurrent = "short",
                    )
                }
            }
        }
    }
})
