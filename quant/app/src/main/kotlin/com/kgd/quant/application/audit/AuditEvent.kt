package com.kgd.quant.application.audit

import java.time.Instant
import java.util.UUID

/**
 * TG-P2-05 / ADR-0026 — 불변 audit_log 1 row 의 도메인 모델.
 *
 * `quant_audit.audit_log` ClickHouse 테이블에 append-only 로 적재된다.
 * prev_hash / current_hash 는 publisher 가 계산하므로 본 모델에는 포함하지 않는다.
 *
 * ## 필드
 * - [auditId]    : row 고유 UUID
 * - [tenantId]   : 멀티테넌시 격리 키
 * - [actor]      : user-id 또는 `system`
 * - [action]     : enum-like 라벨 (`STRATEGY_ACTIVATED`, `CREDENTIAL_CREATED`, `AUDIT_TAMPER_DETECTED`...)
 * - [target]     : 대상 entity 식별자 (strategyId, credentialId 등)
 * - [payloadJson]: 추가 컨텍스트(JSON 문자열). 민감정보(평문 credential, KEK 등) 절대 금지.
 * - [occurredAt] : 행위 발생 시각 (UTC)
 */
data class AuditEvent(
    val auditId: UUID = UUID.randomUUID(),
    val tenantId: String,
    val actor: String,
    val action: String,
    val target: String,
    val payloadJson: String,
    val occurredAt: Instant = Instant.now(),
) {
    init {
        require(tenantId.isNotBlank()) { "tenantId must not be blank" }
        require(actor.isNotBlank()) { "actor must not be blank" }
        require(action.isNotBlank()) { "action must not be blank" }
        require(target.isNotBlank()) { "target must not be blank" }
    }
}
