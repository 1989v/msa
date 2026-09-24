package com.kgd.order.infrastructure.persistence.claim.repository

import com.kgd.order.domain.claim.model.ClaimStatus
import com.kgd.order.infrastructure.persistence.claim.entity.ClaimJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.Instant

interface ClaimJpaRepository : JpaRepository<ClaimJpaEntity, Long> {
    fun findAllByOrderIdOrderByIdAsc(orderId: Long): List<ClaimJpaEntity>

    fun findAllBySellerIdOrderByIdDesc(sellerId: Long, page: Pageable): List<ClaimJpaEntity>

    @Query(
        """
        SELECT DISTINCT c.orderId FROM ClaimJpaEntity c
        WHERE c.status IN :statuses AND c.stuck = false AND c.nextDeadlineAt <= :now
        ORDER BY c.orderId
        """,
    )
    fun findDueOrderIds(statuses: Collection<ClaimStatus>, now: Instant, page: Pageable): List<Long>
}
