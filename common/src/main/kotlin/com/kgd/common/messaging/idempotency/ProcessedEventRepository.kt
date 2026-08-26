package com.kgd.common.messaging.idempotency

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.NoRepositoryBean
import org.springframework.data.repository.query.Param
import java.time.Instant

/**
 * 도메인별 서브인터페이스(`{Domain}ProcessedEventRepository`)가 상속한다.
 * 베이스 자체는 빈이 되지 않는다 — 어느 EMF 에 붙을지는 서브인터페이스의 패키지가 정한다.
 */
@NoRepositoryBean
interface ProcessedEventRepository : JpaRepository<ProcessedEventEntity, ProcessedEventId> {

    @Modifying
    @Query("DELETE FROM ProcessedEventEntity p WHERE p.processedAt < :cutoff")
    fun deleteByProcessedAtBefore(@Param("cutoff") cutoff: Instant): Int
}
