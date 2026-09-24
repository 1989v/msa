package com.kgd.promotion.infrastructure.persistence.hold.adapter

import com.kgd.common.exception.NotFoundException
import com.kgd.promotion.application.hold.port.HoldRestorationRepositoryPort
import com.kgd.promotion.application.hold.port.PromotionHoldRepositoryPort
import com.kgd.promotion.domain.hold.model.HoldRestoration
import com.kgd.promotion.domain.hold.model.PromotionHold
import com.kgd.promotion.domain.hold.model.PromotionHoldStatus
import com.kgd.promotion.infrastructure.persistence.hold.entity.HoldRestorationJpaEntity
import com.kgd.promotion.infrastructure.persistence.hold.entity.PromotionHoldJpaEntity
import com.kgd.promotion.infrastructure.persistence.hold.repository.HoldRestorationJpaRepository
import com.kgd.promotion.infrastructure.persistence.hold.repository.PromotionHoldJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class PromotionHoldRepositoryAdapter(
    private val jpaRepository: PromotionHoldJpaRepository,
) : PromotionHoldRepositoryPort {

    override fun create(hold: PromotionHold): PromotionHold = jpaRepository.saveAndFlush(PromotionHoldJpaEntity.newFrom(hold)).toDomain()

    override fun save(hold: PromotionHold): PromotionHold {
        val id = requireNotNull(hold.id) { "새 보류는 create 로 저장한다" }
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("PromotionHold", id) }
        entity.syncFrom(hold)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findByOrderId(orderId: Long): PromotionHold? = jpaRepository.findByOrderId(orderId)?.toDomain()

    override fun findExpiredReservedOrderIds(now: Instant, limit: Int): List<Long> =
        jpaRepository.findOrderIdsByStatusAndExpiresAtBefore(PromotionHoldStatus.RESERVED, now, PageRequest.of(0, limit))
}

@Component
class HoldRestorationRepositoryAdapter(
    private val jpaRepository: HoldRestorationJpaRepository,
) : HoldRestorationRepositoryPort {

    override fun findByRestoreKey(restoreKey: String): HoldRestoration? = jpaRepository.findByRestoreKey(restoreKey)?.toDomain()

    override fun save(restoration: HoldRestoration) {
        jpaRepository.save(
            HoldRestorationJpaEntity(
                restoreKey = restoration.restoreKey, orderId = restoration.orderId, points = restoration.points,
                couponReturned = restoration.couponReturned, createdAt = restoration.createdAt,
            ),
        )
    }
}
