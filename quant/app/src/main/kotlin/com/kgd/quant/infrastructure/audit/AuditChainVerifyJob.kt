package com.kgd.quant.infrastructure.audit

import com.kgd.quant.application.live.AuditChainService
import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * AuditChainVerifyJob — Phase 3 일일 chain 무결성 검증 (ADR-0037 / TG-P3-32).
 *
 * KST 03:00 cron — `quant.audit.verify.enabled=true` 일 때 활성.
 * 활성 tenant 목록은 별도 구성(`quant.audit.verify.tenants`, comma-separated UUID 문자열).
 * 환경변수로 주입 — 추후 RiskLimit 테이블 전체 스캔으로 자동화.
 *
 * mismatch 발견 시:
 * - 메트릭 `quant_audit_chain_verify_total{result="fail"}` 증가
 * - log.error (alarm 시스템이 pickup)
 * - tenant 자동 suspend 는 호출자(KillSwitchService) 가 별도 wire-up 필요
 */
@Component
@ConditionalOnProperty(name = ["quant.audit.verify.enabled"], havingValue = "true", matchIfMissing = false)
class AuditChainVerifyJob(
    private val service: AuditChainService,
    private val repo: AuditEventRepositoryPort,
    private val meterRegistry: MeterRegistry,
    @Value("\${quant.audit.verify.tenants:}")
    private val tenantsCsv: String,
    @Value("\${quant.audit.verify.limit:100000}")
    private val limit: Int,
) {

    /** KST 03:00 ≈ UTC 18:00 (전일). cron: `0 0 18 * * *` (UTC 기준) */
    @Scheduled(cron = "0 0 18 * * *", zone = "UTC")
    fun runDaily() {
        val tenants = tenantsCsv.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (tenants.isEmpty()) {
            log.info { "audit-verify: no tenants configured (quant.audit.verify.tenants)" }
            return
        }
        log.info { "audit-verify: starting for ${tenants.size} tenants (limit=$limit)" }
        var ok = 0
        var fail = 0
        runBlocking {
            tenants.forEach { tenantValue ->
                try {
                    val tenant = TenantId(tenantValue)
                    val tip = repo.lastTipHash(tenant)
                    val result = service.verify(tenant, limit)
                    when (result) {
                        is AuditEvent.VerifyResult.Ok -> {
                            ok++
                            meterRegistry.counter("quant_audit_chain_verify_total", "result", "ok").increment()
                            log.info { "audit-verify OK tenant=$tenantValue count=${result.count} tip=${tip?.take(8)}…" }
                        }
                        is AuditEvent.VerifyResult.HashMismatch -> {
                            fail++
                            meterRegistry.counter("quant_audit_chain_verify_total", "result", "fail").increment()
                            log.error {
                                "[P1] audit-verify HASH_MISMATCH tenant=$tenantValue idx=${result.index} " +
                                    "stored=${result.stored.take(8)} recomputed=${result.recomputed.take(8)}"
                            }
                        }
                        is AuditEvent.VerifyResult.PrevHashMismatch -> {
                            fail++
                            meterRegistry.counter("quant_audit_chain_verify_total", "result", "fail").increment()
                            log.error {
                                "[P1] audit-verify PREV_HASH_MISMATCH tenant=$tenantValue idx=${result.index} " +
                                    "expected=${result.expected?.take(8)} actual=${result.actual?.take(8)}"
                            }
                        }
                    }
                } catch (ex: Exception) {
                    fail++
                    log.error(ex) { "audit-verify error tenant=$tenantValue" }
                }
            }
        }
        log.info { "audit-verify: done ok=$ok fail=$fail" }
    }
}
