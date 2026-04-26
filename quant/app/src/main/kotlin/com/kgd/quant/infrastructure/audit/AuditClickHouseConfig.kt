package com.kgd.quant.infrastructure.audit

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

/**
 * TG-P2-05 / ADR-0026 — `quant_audit` ClickHouse DB 전용 DataSource.
 *
 * - 운영에서는 `quant_audit_writer` 계정 (INSERT ONLY) 으로 접속한다 (RBAC SOP 별도 문서).
 * - 검증 잡(`AuditChainVerifier`) 도 동일 DataSource 를 SELECT 용으로 재사용한다 — Phase 2 단순화.
 *   (Phase 3 에서 reader 전용 DataSource 분리 검토)
 * - Phase 1 `quant` DB 의 ClickHouseConfig 와 별개 빈으로 등록 (DB / 권한 경계 분리, ADR-0026).
 *
 * ## Activation
 * `quant.audit.enabled=true` 일 때만 빈을 등록한다 (default false).
 * 활성화되지 않으면 [ClickHouseAuditLogPublisher] / [AuditChainVerifier] 도 함께 비활성화된다.
 */
@Configuration
@ConditionalOnProperty(
    name = ["quant.audit.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class AuditClickHouseConfig(
    @Value("\${quant.audit.clickhouse.url:jdbc:clickhouse://localhost:8123/quant_audit}")
    private val url: String,
    @Value("\${quant.audit.clickhouse.user:quant_audit_writer}")
    private val user: String,
    @Value("\${quant.audit.clickhouse.password:}")
    private val password: String,
    @Value("\${quant.audit.clickhouse.pool-size:4}")
    private val poolSize: Int,
) {
    @Bean("auditDataSource")
    fun auditDataSource(): DataSource {
        val cfg = HikariConfig().apply {
            jdbcUrl = url
            username = user
            password = this@AuditClickHouseConfig.password
            driverClassName = "com.clickhouse.jdbc.ClickHouseDriver"
            maximumPoolSize = poolSize
            poolName = "quant-audit-clickhouse"
            // ClickHouse 는 명시적 commit 이 없으므로 auto-commit true 유지.
            isAutoCommit = true
        }
        return HikariDataSource(cfg)
    }
}
