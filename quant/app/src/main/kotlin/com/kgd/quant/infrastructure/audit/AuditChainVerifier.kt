package com.kgd.quant.infrastructure.audit

import com.kgd.quant.application.port.notification.NotificationEvent
import com.kgd.quant.application.port.notification.NotificationSender
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.sql.ResultSet
import javax.sql.DataSource

private val log = KotlinLogging.logger {}

/**
 * TG-P2-05 / ADR-0026 — `quant_audit.audit_log` chain 무결성 검증 잡.
 *
 * ## 동작
 * - 1시간 주기 (fixedDelay = 3,600,000 ms)
 * - 직전 1시간 분량 row 를 `(tenant_id, occurred_at, audit_id)` 순으로 replay
 * - 각 row 의 `current_hash` 가 [AuditHashing.computeCurrentHash] 결과와 일치하는지 비교
 * - 불일치 발견 시:
 *   - `quant_audit_hash_chain_invalid_total` 메트릭 증가
 *   - CRITICAL Telegram 알림 발송 (NotificationEvent.RiskLimitBreached, limitType="AUDIT_TAMPER")
 *
 * ## Phase 2 가정
 * - replicas=1 + 단일 publisher (ADR-0026 §6 / ADR-0025) — chain 직렬화 보장.
 * - 검증 잡은 reader 권한이면 충분하지만 Phase 2 단순화를 위해 writer DataSource 를 SELECT 용도로 재사용.
 *   (Phase 3 에서 reader 전용 DataSource 분리 검토)
 *
 * ## 비활성화 옵션
 * - `quant.audit.enabled=false` (default) → audit 전체 비활성, DataSource 도 미등록.
 * - `quant.audit.chain-verifier.enabled=false` → audit 발행은 살리고 잡만 정지 (테스트 등).
 */
@Component
@ConditionalOnProperty(
    name = ["quant.audit.chain-verifier.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class AuditChainVerifier(
    @Qualifier("auditDataSource") private val auditDataSource: DataSource,
    private val metrics: QuantMetrics,
    private val notificationSender: NotificationSender,
) {

    @Scheduled(fixedDelay = VERIFY_INTERVAL_MS)
    fun verifyLastHour() {
        try {
            val invalid = runBlocking { verify() }
            if (invalid > 0) {
                metrics.auditHashChainInvalid(invalid)
                runBlocking {
                    notificationSender.send(
                        SYSTEM_TENANT,
                        NotificationEvent.RiskLimitBreached(
                            limitType = TAMPER_LIMIT_TYPE,
                            value = "$invalid invalid rows in last hour",
                        ),
                    )
                }
            }
        } catch (ex: Exception) {
            // 잡 자체 실패는 다음 주기에 재시도. 메트릭 만 기록.
            log.error(ex) { "audit chain verifier execution failed: ${ex.message}" }
        }
    }

    /**
     * 직전 1시간 audit row 를 replay 하며 invalid 개수를 반환한다.
     * 테스트에서 직접 호출 가능하도록 public.
     */
    suspend fun verify(): Int {
        return withContext(Dispatchers.IO) {
            var invalid = 0
            auditDataSource.connection.use { conn ->
                conn.prepareStatement(SELECT_RECENT_SQL).use { stmt ->
                    stmt.executeQuery().use { rs ->
                        val expectedPrevByTenant = mutableMapOf<String, String>()
                        while (rs.next()) {
                            if (!verifyRow(rs, expectedPrevByTenant)) {
                                invalid++
                            }
                        }
                    }
                }
            }
            invalid
        }
    }

    private fun verifyRow(rs: ResultSet, expectedPrevByTenant: MutableMap<String, String>): Boolean {
        val tenantId = rs.getString(COL_TENANT_ID)
        val payloadJson = rs.getString(COL_PAYLOAD)
        val occurredAt = rs.getTimestamp(COL_OCCURRED_AT).toInstant()
        val actor = rs.getString(COL_ACTOR)
        val prevHash = rs.getString(COL_PREV_HASH)
        val currentHash = rs.getString(COL_CURRENT_HASH)

        // chain 검증: 본 row 의 prev_hash 가 직전 row 의 current_hash 와 일치해야 한다.
        val expectedPrev = expectedPrevByTenant[tenantId] ?: AuditHashing.GENESIS_HASH
        val prevOk = prevHash == expectedPrev

        // hash 무결성: 본 row 의 current_hash 가 자체 입력 재계산과 일치해야 한다.
        val recomputed = AuditHashing.computeCurrentHash(
            prevHash = prevHash,
            payloadJson = payloadJson,
            occurredAt = occurredAt,
            actor = actor,
        )
        val hashOk = currentHash == recomputed

        if (!prevOk) {
            log.error {
                "audit chain prev_hash mismatch tenantId=$tenantId expectedPrev=$expectedPrev actualPrev=$prevHash"
            }
        }
        if (!hashOk) {
            log.error {
                "audit chain current_hash mismatch tenantId=$tenantId expected=$recomputed actual=$currentHash"
            }
        }

        // 다음 row 가 prev 로 사용해야 할 값은 본 row 의 current_hash (chain 진행 유지).
        expectedPrevByTenant[tenantId] = currentHash
        return prevOk && hashOk
    }

    companion object {
        const val VERIFY_INTERVAL_MS: Long = 3_600_000L
        const val TAMPER_LIMIT_TYPE: String = "AUDIT_TAMPER"
        val SYSTEM_TENANT: TenantId = TenantId("system")

        // ResultSet column 1-based index (SELECT 순서와 일치)
        private const val COL_TENANT_ID = 1
        private const val COL_PAYLOAD = 3
        private const val COL_OCCURRED_AT = 4
        private const val COL_ACTOR = 5
        private const val COL_PREV_HASH = 6
        private const val COL_CURRENT_HASH = 7

        private const val SELECT_RECENT_SQL = """
            SELECT tenant_id, audit_id, payload_json, occurred_at, actor, prev_hash, current_hash
            FROM quant_audit.audit_log
            WHERE occurred_at >= now() - INTERVAL 1 HOUR
            ORDER BY tenant_id, occurred_at, audit_id
        """
    }
}
