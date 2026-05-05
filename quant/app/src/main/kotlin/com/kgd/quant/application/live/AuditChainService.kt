package com.kgd.quant.application.live

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEvent
import com.kgd.quant.domain.live.AuditEventType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * AuditChainService — Phase 3 hash-chain audit (ADR-0037 / TG-P3-31).
 *
 * - payload 직렬화: ObjectMapper + SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS (canonical JSON)
 * - chain: prevHash → currentHash (SHA-256)
 *
 * 호출자 (KillSwitchService / PlaceLiveOrderUseCase / TwoFactorService 등) 가 본 서비스로
 * append 만 호출하면 chain 무결성 자동 보장.
 */
@Service
class AuditChainService(
    private val repo: AuditEventRepositoryPort,
    objectMapper: ObjectMapper,
) {
    private val canonicalMapper: ObjectMapper = objectMapper.copy()
        .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)

    /**
     * payload 를 canonical JSON 으로 직렬화 후 chain 에 append.
     */
    suspend fun append(
        tenantId: TenantId,
        eventType: AuditEventType,
        payload: Map<String, Any?>,
        occurredAt: Instant = Instant.now(),
    ): AuditEvent {
        val payloadCanonical = canonicalMapper.writeValueAsString(payload.toSortedMap())
        val prevHash = repo.lastTipHash(tenantId)
        val event = AuditEvent.append(
            tenantId = tenantId,
            eventType = eventType,
            payloadCanonical = payloadCanonical,
            occurredAt = occurredAt,
            prevHash = prevHash,
        )
        repo.append(event)
        log.debug {
            "audit append tenant=${tenantId.value} type=$eventType hash=${event.currentHash.take(8)}…"
        }
        return event
    }

    /**
     * [tenantId] 의 마지막 [limit] 이벤트 chain 검증 — 일일 verify job 이 호출.
     */
    suspend fun verify(tenantId: TenantId, limit: Int = DEFAULT_VERIFY_LIMIT): AuditEvent.VerifyResult {
        val events = repo.loadAscending(tenantId, limit)
        if (events.isEmpty()) return AuditEvent.VerifyResult.Ok(0, null)
        // verify 의 prevTip 은 첫 이벤트의 prevHash 와 비교 — 첫 이벤트는 chain 시작 (null) 이거나 sliding 시 외부 tip.
        // sliding 시작점에서 직전 이벤트의 hash 를 외부에서 주입하지 않으면 첫 prevHash 그대로 사용.
        return AuditEvent.verify(events, prevTip = events.first().prevHash)
    }

    companion object {
        const val DEFAULT_VERIFY_LIMIT = 100_000
    }
}
