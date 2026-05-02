package com.kgd.common.messaging.outbox

import org.springframework.data.jpa.repository.JpaRepository

/**
 * Spring Data JPA repository for [OutboxEntity].
 *
 * `findAllByStatusOrderByCreatedAtAsc("PENDING")` 가 polling publisher 의 핵심 쿼리.
 * 신규 아이템은 항상 가장 오래된 PENDING row 부터 처리되어 FIFO 순서가 유지된다.
 */
interface OutboxRepository : JpaRepository<OutboxEntity, Long> {
    fun findAllByStatusOrderByCreatedAtAsc(status: String): List<OutboxEntity>
    fun countByStatus(status: String): Long
}
