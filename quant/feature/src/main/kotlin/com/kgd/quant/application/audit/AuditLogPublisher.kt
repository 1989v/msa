package com.kgd.quant.application.audit

/**
 * TG-P2-05 / ADR-0026 — audit_log 발행 port.
 *
 * ## 계약
 * - 구현체는 (1) prev_hash 조회 → (2) current_hash = SHA-256 계산 → (3) ClickHouse INSERT(writer user)
 *   → (4) Outbox 에 Kafka mirror 이벤트 append 순으로 처리한다.
 * - prev_hash 계산은 단일 인스턴스(replicas=1) 가정에서 in-process Mutex 로 직렬화 (Phase 2).
 *   Phase 3+ multi-replica 에서는 leader election 또는 sequence 서비스로 후속 처리.
 * - INV-P2-10: prev_hash 누락 시 application 레벨에서 publish 거부.
 *
 * ## @Transactional 금지
 * 본 port 호출 경로는 외부 IO (ClickHouse JDBC + Outbox JPA) 가 섞이므로 `@Transactional` 을
 * 부착하지 않는다 (ADR-0020).
 */
interface AuditLogPublisher {
    suspend fun publish(event: AuditEvent)
}
