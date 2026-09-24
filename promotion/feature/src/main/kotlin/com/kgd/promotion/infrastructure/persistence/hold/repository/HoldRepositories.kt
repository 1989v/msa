package com.kgd.promotion.infrastructure.persistence.hold.repository

import com.kgd.promotion.domain.hold.model.PromotionHoldStatus
import com.kgd.promotion.infrastructure.persistence.hold.entity.HoldRestorationJpaEntity
import com.kgd.promotion.infrastructure.persistence.hold.entity.PromotionHoldJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface PromotionHoldJpaRepository : JpaRepository<PromotionHoldJpaEntity, Long> {
    fun findByOrderId(orderId: Long): PromotionHoldJpaEntity?

    @Query(
        "SELECT h.orderId FROM PromotionHoldJpaEntity h " +
            "WHERE h.status = :status AND h.expiresAt <= :now ORDER BY h.expiresAt ASC",
    )
    fun findOrderIdsByStatusAndExpiresAtBefore(
        @Param("status") status: PromotionHoldStatus,
        @Param("now") now: Instant,
        pageable: Pageable,
    ): List<Long>
}

interface HoldRestorationJpaRepository : JpaRepository<HoldRestorationJpaEntity, Long> {
    fun findByRestoreKey(restoreKey: String): HoldRestorationJpaEntity?
}
