package com.kgd.promotion.infrastructure.scheduler

import com.kgd.promotion.application.hold.usecase.ExpirePromotionHoldsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** 보류 기한이 지난 RESERVED 를 만료시킨다 — 쿠폰·포인트를 풀고 `promotion.hold.expired` */
@Component
class PromotionHoldExpiryScheduler(
    private val expire: ExpirePromotionHoldsUseCase,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(fixedDelayString = "\${promotion.hold-expiry.interval-ms:30000}", initialDelayString = "\${promotion.hold-expiry.initial-delay-ms:30000}")
    fun run() {
        val expired = expire.expireDue()
        if (expired > 0) log.info { "혜택 보류 만료: $expired 건" }
    }
}
