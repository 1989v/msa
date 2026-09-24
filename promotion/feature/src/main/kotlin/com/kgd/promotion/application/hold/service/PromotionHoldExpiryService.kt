package com.kgd.promotion.application.hold.service

import com.kgd.promotion.application.hold.port.PromotionHoldRepositoryPort
import com.kgd.promotion.application.hold.usecase.ExpirePromotionHoldsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock

/** 기한이 지난 보류를 하나씩 자기 트랜잭션으로 만료시킨다 — 한 건의 실패가 나머지를 막지 않는다 */
@Service
class PromotionHoldExpiryService(
    private val holds: PromotionHoldRepositoryPort,
    private val holdService: PromotionHoldService,
    @Qualifier("promotionClock") private val clock: Clock,
) : ExpirePromotionHoldsUseCase {
    private val log = KotlinLogging.logger {}

    override fun expireDue(): Int =
        holds.findExpiredReservedOrderIds(clock.instant(), BATCH).count { orderId ->
            runCatching { holdService.expire(orderId) }
                .onFailure { log.warn(it) { "혜택 보류 만료 실패 — 다음 주기에 다시: orderId=$orderId" } }
                .getOrDefault(false)
        }

    private companion object {
        const val BATCH = 100
    }
}
