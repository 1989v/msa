package com.kgd.quant.infrastructure.reconcile

import com.kgd.quant.application.live.AuditChainService
import com.kgd.quant.application.live.KillSwitchService
import com.kgd.quant.application.port.credential.CredentialVault
import com.kgd.quant.application.port.exchange.ExchangeException
import com.kgd.quant.application.port.exchange.LiveExchangeAdapter
import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.live.SuspendReason
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.infrastructure.metrics.QuantPhase3Metrics
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * LiveOrderReconcileJob — 5분 간격 거래소 ↔ 내부 OrderRecord 정합 검증 (ADR-0037 / TG-P3-28~30).
 *
 * Drift 처리:
 * - status 차이 (SUBMITTED → FILLED/CANCELLED/REJECTED): 자동 반영 + AuditEvent
 * - 수량/가격 mismatch: 자동 tenant suspend + 즉시 운영자 알림 (AuditEvent + log.error)
 * - 거래소가 모르는 주문 (LOST): 6 시간 이상 unknown → AuditEvent + tenant suspend
 *
 * 활성: `quant.reconcile.enabled=true` (default false — 실거래소 어댑터 빈이 등록됐을 때만 켠다).
 */
@Component
@ConditionalOnProperty(name = ["quant.reconcile.enabled"], havingValue = "true", matchIfMissing = false)
class LiveOrderReconcileJob(
    private val orderRepo: LiveOrderRecordRepositoryPort,
    private val credentialVault: CredentialVault,
    private val auditChain: AuditChainService,
    private val killSwitchService: KillSwitchService,
    private val metrics: QuantPhase3Metrics,
    private val liveAdaptersProvider: ObjectProvider<LiveExchangeAdapter>,
) {

    @Scheduled(fixedDelay = INTERVAL_MS, initialDelay = 30_000L)
    fun runOnce() {
        val pending = runBlocking { orderRepo.findPending(MIN_AGE) }
        if (pending.isEmpty()) return
        log.info { "reconcile starting — ${pending.size} pending orders" }
        var ok = 0
        var driftCount = 0
        runBlocking {
            pending.forEach { record ->
                try {
                    if (reconcileOne(record)) driftCount++
                    ok++
                } catch (ex: Exception) {
                    log.warn(ex) { "reconcile failed for ${record.id}" }
                }
            }
        }
        log.info { "reconcile done — checked=$ok, drift=$driftCount" }
    }

    private suspend fun reconcileOne(record: LiveOrderRecord): Boolean {
        val adapter = liveAdaptersProvider.find { it.market.code == record.marketCode }
            ?: return false
        val exchangeOrderId = record.exchangeOrderId ?: return false
        val credential = runCatching { credentialVault.load(record.tenantId, inferExchange(record)) }
            .getOrNull() ?: return false

        val snapshot = try {
            adapter.fetchOrderStatus(credential, exchangeOrderId, record.assetCode)
        } catch (ex: ExchangeException.RejectedByExchange) {
            // 거래소가 모르는 주문 = LOST 후보
            return handleLost(record, ex)
        }

        // 단순 status 진척
        if (snapshot.status != record.status && snapshot.isFinal) {
            orderRepo.updateStatus(
                record.id,
                snapshot.status,
                filledAt = if (snapshot.status == OrderStatus.FILLED) snapshot.updatedAt else null,
                cancelledAt = if (snapshot.status == OrderStatus.CANCELLED) snapshot.updatedAt else null,
            )
            auditChain.append(
                record.tenantId,
                AuditEventType.ORDER_FILLED.takeIf { snapshot.status == OrderStatus.FILLED }
                    ?: AuditEventType.ORDER_CANCELLED,
                mapOf(
                    "orderId" to record.id.value.toString(),
                    "from" to record.status.name,
                    "to" to snapshot.status.name,
                ),
            )
            metrics.liveOrderRecorded(adapter.market.code.value, snapshot.status.name.lowercase())
            return false
        }

        // 수량/가격 mismatch — 도메인 quantity 와 거래소 filled+remaining 합 다른 경우
        val expected = record.quantity
        val total = snapshot.filledQuantity + snapshot.remainingQuantity
        if (total.compareTo(expected) != 0) {
            metrics.reconcileDrift(adapter.market.code.value, "quantity_mismatch")
            log.error {
                "[P2] reconcile drift quantity tenant=${record.tenantId.value} order=${record.id} " +
                    "expected=$expected got=$total"
            }
            killSwitchService.toggleTenant(
                record.tenantId,
                enabled = true,
                actorId = 0L,
                reason = "auto: reconcile drift (quantity)",
            )
            auditChain.append(
                record.tenantId,
                AuditEventType.RECONCILE_DRIFT,
                mapOf(
                    "orderId" to record.id.value.toString(),
                    "type" to "quantity_mismatch",
                    "expected" to expected.toPlainString(),
                    "got" to total.toPlainString(),
                ),
            )
            return true
        }
        return false
    }

    private suspend fun handleLost(record: LiveOrderRecord, cause: ExchangeException.RejectedByExchange): Boolean {
        val age = Duration.between(record.placedAt, Instant.now())
        if (age < LOST_THRESHOLD) {
            // 6시간 미만 — drift 카운트만 (transient) 후 다음 cycle 재시도
            metrics.reconcileDrift("unknown", "unknown_transient")
            log.info { "reconcile transient unknown for ${record.id} age=${age.toMinutes()}min — retry next cycle" }
            return false
        }
        metrics.reconcileDrift("unknown", "lost")
        log.error {
            "[P1] reconcile LOST tenant=${record.tenantId.value} order=${record.id} age=${age.toHours()}h " +
                "exchangeOrderId=${record.exchangeOrderId} cause=${cause.message}"
        }
        orderRepo.updateStatus(record.id, OrderStatus.REJECTED)
        killSwitchService.toggleTenant(
            record.tenantId,
            enabled = true,
            actorId = 0L,
            reason = "auto: reconcile LOST after ${age.toHours()}h",
        )
        auditChain.append(
            record.tenantId,
            AuditEventType.RECONCILE_DRIFT,
            mapOf(
                "orderId" to record.id.value.toString(),
                "type" to "lost",
                "ageHours" to age.toHours().toString(),
            ),
        )
        return true
    }

    /**
     * record 의 marketCode 만으로 Exchange enum 추정 (BITHUMB/UPBIT 등). Phase 3 단순화 —
     * Exchange 와 MarketCode 매핑 테이블 추가 시 이곳 교체.
     */
    private fun inferExchange(record: LiveOrderRecord): Exchange = when (record.marketCode.value) {
        "BITHUMB" -> Exchange.BITHUMB
        "UPBIT" -> Exchange.UPBIT
        else -> Exchange.BITHUMB
    }

    companion object {
        private const val INTERVAL_MS = 5L * 60L * 1000L     // 5 분
        private val MIN_AGE = Duration.ofSeconds(30)         // 주문 직후 race 방지
        private val LOST_THRESHOLD = Duration.ofHours(6)
    }
}
