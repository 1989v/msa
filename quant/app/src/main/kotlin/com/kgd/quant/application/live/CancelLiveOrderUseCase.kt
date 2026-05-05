package com.kgd.quant.application.live

import com.kgd.quant.application.port.credential.CredentialVault
import com.kgd.quant.application.port.exchange.LiveExchangeAdapter
import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.order.OrderStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Service
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * CancelLiveOrderUseCase — 사용자 수동 주문 취소 (ADR-0037 / TG-P3-27).
 *
 * 흐름:
 * 1. OrderRecord 조회 + tenant 일치 검증
 * 2. 거래소 어댑터 cancelOrder 호출
 * 3. OrderRecord status → CANCELLED
 * 4. AuditEvent(ORDER_CANCELLED) 기록
 */
@Service
class CancelLiveOrderUseCase(
    private val orderRepo: LiveOrderRecordRepositoryPort,
    private val credentialVault: CredentialVault,
    private val auditChain: AuditChainService,
    private val liveAdaptersProvider: ObjectProvider<LiveExchangeAdapter>,
) {
    suspend fun execute(tenantId: TenantId, orderId: OrderId, exchange: Exchange): LiveOrderRecord {
        val record = orderRepo.findById(orderId)
            ?: throw IllegalArgumentException("LiveOrderRecord not found: $orderId")
        require(record.tenantId == tenantId) {
            "tenant mismatch: requested=${tenantId.value} record=${record.tenantId.value}"
        }
        if (record.status == OrderStatus.CANCELLED || record.status == OrderStatus.FILLED) {
            log.info { "order $orderId already terminal (${record.status}) — no-op" }
            return record
        }
        val adapter = liveAdaptersProvider.find { it.market.code == record.marketCode }
            ?: throw IllegalStateException("LiveExchangeAdapter for ${record.marketCode.value} not registered")
        val credential = credentialVault.load(tenantId, exchange)
        val exchangeOrderId = record.exchangeOrderId
            ?: throw IllegalStateException("exchangeOrderId missing for $orderId")
        val ack = adapter.cancelOrder(credential, exchangeOrderId, record.assetCode)
        orderRepo.updateStatus(orderId, OrderStatus.CANCELLED, cancelledAt = ack.cancelledAt)
        auditChain.append(
            tenantId,
            AuditEventType.ORDER_CANCELLED,
            mapOf(
                "orderId" to orderId.value.toString(),
                "exchangeOrderId" to exchangeOrderId,
                "cancelledAt" to ack.cancelledAt.toString(),
            ),
        )
        log.info { "order $orderId cancelled (exchange=$exchangeOrderId)" }
        return record.copy(
            status = OrderStatus.CANCELLED,
            cancelledAt = ack.cancelledAt,
        )
    }
}
