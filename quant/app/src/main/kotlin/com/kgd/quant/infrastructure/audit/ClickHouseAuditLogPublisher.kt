package com.kgd.quant.infrastructure.audit

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.audit.AuditEvent
import com.kgd.quant.application.audit.AuditLogPublisher
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.persistence.entity.OutboxEntity
import com.kgd.quant.infrastructure.persistence.repository.OutboxJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.time.ZoneOffset
import java.util.concurrent.ConcurrentHashMap
import javax.sql.DataSource

private val log = KotlinLogging.logger {}

/**
 * TG-P2-05 / ADR-0026 — `quant_audit.audit_log` 에 prev_hash chain 으로 row 를 append 하는 어댑터.
 *
 * ## 흐름
 * 1. tenantId 단위 [Mutex] 로 직렬화 (race condition 방지)
 * 2. 직전 hash 조회 — process 캐시 우선, miss 시 DB `SELECT current_hash ... LIMIT 1`
 * 3. `current_hash = SHA256(prev_hash || payload_json || occurred_at || actor)` 계산
 * 4. `INSERT INTO quant_audit.audit_log (..., prev_hash, current_hash) VALUES (...)`
 * 5. Kafka mirror 용 Outbox row append (best-effort — 실패 시 audit 자체는 성공으로 간주)
 * 6. process 캐시 갱신
 *
 * ## INV-P2-10
 * prev_hash 는 항상 64자(GENESIS 또는 SHA-256 hex). 어떤 경로에서도 NULL/blank 가 INSERT 되지 않는다.
 *
 * ## 멀티 인스턴스 (Phase 3 후속)
 * Phase 2 = replicas=1 가정 (ADR-0025). Mutex + process 캐시는 단일 JVM 가정에서만 정확하며,
 * 다중 인스턴스에서는 leader pod 또는 sequence 서비스로 후속 처리.
 *
 * ## @Transactional 금지
 * ClickHouse JDBC + MySQL Outbox JPA 를 모두 호출하는 외부 IO 합성. ADR-0020 에 따라
 * 클래스/메서드 레벨 `@Transactional` 부착하지 않는다. Outbox append 는 best-effort 로 mirror 용도.
 */
@Component
@ConditionalOnProperty(
    name = ["quant.audit.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class ClickHouseAuditLogPublisher(
    @Qualifier("auditDataSource") private val auditDataSource: DataSource,
    private val outboxRepo: OutboxJpaRepository,
    private val objectMapper: ObjectMapper,
    private val metrics: QuantMetrics,
) : AuditLogPublisher {

    /** tenantId 별 Mutex — chain 재정렬 방지. */
    private val tenantLocks = ConcurrentHashMap<String, Mutex>()

    /** tenantId 별 직전 current_hash process 캐시. miss 시 DB lookup. */
    private val lastHashByTenant = ConcurrentHashMap<String, String>()

    override suspend fun publish(event: AuditEvent) {
        val mutex = tenantLocks.computeIfAbsent(event.tenantId) { Mutex() }

        mutex.withLock {
            val prevHash = lastHashByTenant[event.tenantId]
                ?: fetchLastHashFromDb(event.tenantId)
                ?: AuditHashing.GENESIS_HASH

            // INV-P2-10 application-level enforcement.
            require(prevHash.length == HASH_LENGTH) {
                "prev_hash invalid length=${prevHash.length}, expected=$HASH_LENGTH"
            }

            val currentHash = AuditHashing.computeCurrentHash(
                prevHash = prevHash,
                payloadJson = event.payloadJson,
                occurredAt = event.occurredAt,
                actor = event.actor,
            )

            insertRow(event = event, prevHash = prevHash, currentHash = currentHash)
            mirrorToOutbox(event = event, prevHash = prevHash, currentHash = currentHash)

            lastHashByTenant[event.tenantId] = currentHash
            metrics.auditLogAppended()
        }
    }

    private suspend fun insertRow(event: AuditEvent, prevHash: String, currentHash: String) {
        withContext(Dispatchers.IO) {
            auditDataSource.connection.use { conn ->
                conn.prepareStatement(INSERT_SQL).use { stmt ->
                    // ClickHouse JDBC 는 UUID / LocalDateTime 을 setString / setObject 로 받는다.
                    // 단순화 + 호환성 안전성 위해 모두 String 으로 직렬화.
                    stmt.setString(1, event.auditId.toString())
                    stmt.setString(2, event.tenantId)
                    stmt.setString(3, event.actor)
                    stmt.setString(4, event.action)
                    stmt.setString(5, event.target)
                    stmt.setString(6, event.payloadJson)
                    // DateTime64(3, 'UTC') — ISO-8601 with milliseconds, no zone suffix
                    stmt.setObject(7, event.occurredAt.atOffset(ZoneOffset.UTC).toLocalDateTime())
                    stmt.setString(8, prevHash)
                    stmt.setString(9, currentHash)
                    stmt.executeUpdate()
                }
            }
        }
    }

    private suspend fun fetchLastHashFromDb(tenantId: String): String? {
        return withContext(Dispatchers.IO) {
            auditDataSource.connection.use { conn ->
                conn.prepareStatement(SELECT_LAST_HASH_SQL).use { stmt ->
                    stmt.setString(1, tenantId)
                    stmt.executeQuery().use { rs ->
                        if (rs.next()) rs.getString(1) else null
                    }
                }
            }
        }
    }

    private fun mirrorToOutbox(event: AuditEvent, prevHash: String, currentHash: String) {
        runCatching {
            val mirrorPayload = objectMapper.writeValueAsString(
                AuditMirrorPayload(
                    auditId = event.auditId.toString(),
                    tenantId = event.tenantId,
                    actor = event.actor,
                    action = event.action,
                    target = event.target,
                    payloadJson = event.payloadJson,
                    occurredAt = event.occurredAt.toString(),
                    prevHash = prevHash,
                    currentHash = currentHash,
                )
            )
            outboxRepo.save(
                OutboxEntity(
                    eventId = event.auditId,
                    eventType = AUDIT_MIRROR_EVENT_TYPE,
                    tenantId = event.tenantId,
                    payload = mirrorPayload,
                    occurredAt = event.occurredAt,
                    publishedAt = null,
                )
            )
        }.onFailure { ex ->
            // best-effort: ClickHouse 적재는 성공했으므로 audit 자체는 살리고, mirror 실패만 경고.
            log.warn(ex) { "audit kafka mirror outbox append failed (best-effort) auditId=${event.auditId}" }
        }
    }

    /**
     * Outbox payload 직렬화용 내부 DTO. Phase 2 단순 JSON.
     * Phase 3 schema registry 도입 시 본 형식은 deprecated 예정.
     */
    private data class AuditMirrorPayload(
        val auditId: String,
        val tenantId: String,
        val actor: String,
        val action: String,
        val target: String,
        val payloadJson: String,
        val occurredAt: String,
        val prevHash: String,
        val currentHash: String,
    )

    companion object {
        const val HASH_LENGTH: Int = 64
        const val AUDIT_MIRROR_EVENT_TYPE: String = "AUDIT_LOG_APPENDED"
        const val AUDIT_KAFKA_TOPIC: String = "quant.audit.v1"

        private const val INSERT_SQL = """
            INSERT INTO quant_audit.audit_log
                (audit_id, tenant_id, actor, action, target, payload_json, occurred_at, prev_hash, current_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        private const val SELECT_LAST_HASH_SQL = """
            SELECT current_hash
            FROM quant_audit.audit_log
            WHERE tenant_id = ?
            ORDER BY occurred_at DESC, audit_id DESC
            LIMIT 1
        """
    }
}
