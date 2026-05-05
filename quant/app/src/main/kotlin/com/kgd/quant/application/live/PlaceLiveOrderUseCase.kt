package com.kgd.quant.application.live

import com.kgd.quant.application.port.credential.CredentialVault
import com.kgd.quant.application.port.exchange.ExchangeException
import com.kgd.quant.application.port.exchange.LiveExchangeAdapter
import com.kgd.quant.application.port.exchange.OrderPlacement
import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.live.SuspendReason
import com.kgd.quant.domain.order.OrderStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * PlaceLiveOrderUseCase — Phase 3 7-stage 실주문 게이트 (ADR-0037 / TG-P3-26).
 *
 * 게이트 순서:
 * 1. live-mode == Enabled (별도 LiveModeService — 본 단계는 RiskLimit 기록 후 평가)
 * 2. global-kill-switch == OFF
 * 3. tenant-kill-switch == OFF
 * 4. strategy-kill-switch == OFF
 * 5. dailyLossKrw + estimatedLoss <= dailyLossLimitKrw
 * 6. dailyVolumeKrw + orderVolumeKrw <= dailyVolumeLimitKrw
 * 7. orderVolumeKrw <= singleOrderMaxKrw
 *
 * 게이트 통과 후:
 * - LiveExchangeAdapter.placeOrder() 호출 (어댑터별 RateLimiter / 서명 / 재시도는 어댑터 책임)
 * - 성공 → AuditChain.append(ORDER_PLACED) → LiveOrderRecord persist
 * - 실패 → AuditChain.append(ORDER_REJECTED) → ExchangeException 그대로 throw
 */
@Service
class PlaceLiveOrderUseCase(
    private val killSwitchService: KillSwitchService,
    private val riskLimitService: RiskLimitService,
    private val auditChain: AuditChainService,
    private val credentialVault: CredentialVault,
    private val orderRepo: LiveOrderRecordRepositoryPort,
    private val liveAdaptersProvider: ObjectProvider<LiveExchangeAdapter>,
) {
    suspend fun execute(input: Input): LiveOrderRecord {
        val now = Instant.now()
        val orderKrw = (input.priceKrw ?: BigDecimal.ZERO).multiply(input.placement.quantity)

        // 게이트 2~4: kill-switch 3-레벨
        val ks = killSwitchService.snapshot(input.tenantId, input.strategyId)
        if (ks.anyEnabled) {
            val reason = when {
                ks.global -> "global"
                ks.tenant -> "tenant"
                else -> "strategy"
            }
            audit(input, AuditEventType.ORDER_REJECTED, mapOf("stage" to "kill-switch", "level" to reason), now)
            throw OrderRejectedByGate("kill-switch ON ($reason)", SuspendReason.USER_KILL_SWITCH)
        }

        // 게이트 5~7: risk-limit (단일 주문 + 일일 누적 평가)
        when (val r = riskLimitService.evaluatePreOrder(input.tenantId, orderKrw)) {
            is RiskLimitService.PreOrderResult.Reject -> {
                audit(input, AuditEventType.ORDER_REJECTED, mapOf("stage" to "risk-limit", "reason" to r.reason.name, "detail" to r.detail), now)
                throw OrderRejectedByGate(r.detail, r.reason)
            }
            is RiskLimitService.PreOrderResult.Allow -> { /* 통과 */ }
        }

        // 게이트 통과 — 거래소 호출
        val adapter = liveAdaptersProvider.find { it.market.code == input.placement.marketCode }
            ?: throw IllegalStateException("LiveExchangeAdapter for ${input.placement.marketCode.value} not registered")
        val credential = credentialVault.load(input.tenantId, input.exchange)

        val ack = try {
            adapter.placeOrder(credential, input.placement)
        } catch (ex: ExchangeException) {
            audit(input, AuditEventType.ORDER_REJECTED, mapOf("stage" to "exchange", "error" to ex.javaClass.simpleName, "msg" to (ex.message ?: "")), now)
            throw ex
        }

        // 성공 — AuditChain + OrderRecord persist
        val orderId = OrderId.newV7()
        val prevHash = orderRepo.lastAuditHash(input.tenantId, input.strategyId)
        val auditEvent = auditChain.append(
            tenantId = input.tenantId,
            eventType = AuditEventType.ORDER_PLACED,
            payload = mapOf(
                "orderId" to orderId.value.toString(),
                "strategyId" to input.strategyId.value.toString(),
                "market" to input.placement.marketCode.value,
                "asset" to input.placement.assetCode.value,
                "side" to input.placement.side.name,
                "type" to input.placement.type.name(),
                "quantity" to input.placement.quantity.toPlainString(),
                "exchangeOrderId" to ack.exchangeOrderId,
            ),
            occurredAt = now,
        )
        val record = LiveOrderRecord(
            id = orderId,
            tenantId = input.tenantId,
            strategyId = input.strategyId,
            marketCode = input.placement.marketCode,
            assetCode = input.placement.assetCode,
            side = input.placement.side,
            type = input.placement.type,
            priceKrw = input.priceKrw,
            quantity = input.placement.quantity,
            status = OrderStatus.SUBMITTED,
            exchangeOrderId = ack.exchangeOrderId,
            placedAt = ack.acceptedAt,
            filledAt = null,
            cancelledAt = null,
            auditHashPrev = prevHash,
            auditHashCurrent = auditEvent.currentHash,
        )
        orderRepo.save(record)
        log.info { "live order placed orderId=${orderId} exchangeOrderId=${ack.exchangeOrderId}" }
        return record
    }

    private suspend fun audit(
        input: Input,
        type: AuditEventType,
        payload: Map<String, Any?>,
        at: Instant,
    ) {
        auditChain.append(
            tenantId = input.tenantId,
            eventType = type,
            payload = payload + mapOf(
                "strategyId" to input.strategyId.value.toString(),
                "market" to input.placement.marketCode.value,
                "asset" to input.placement.assetCode.value,
            ),
            occurredAt = at,
        )
    }

    /** SpotOrderType 의 sealed 자식이름 — 인스턴스를 단순 문자열로 마킹. */
    private fun com.kgd.quant.domain.order.SpotOrderType.name(): String = this::class.simpleName ?: "UNKNOWN"

    data class Input(
        val tenantId: TenantId,
        val strategyId: StrategyId,
        val exchange: Exchange,
        val placement: OrderPlacement,
        val priceKrw: BigDecimal?,
    )

    class OrderRejectedByGate(message: String, val reason: SuspendReason) : RuntimeException(message)
}
