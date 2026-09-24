package com.kgd.seller.infrastructure.scheduler

import com.kgd.seller.application.seller.usecase.PurgeRejectedApplicationsUseCase
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** 반려 신청 개인정보 파기 — 하루 한 번. 기한 판정은 유스케이스·도메인이 한다. */
@Component
class RejectedSellerPurgeScheduler(
    private val purge: PurgeRejectedApplicationsUseCase,
) {
    @Scheduled(cron = "\${seller.pii-purge.cron:0 20 4 * * *}", zone = "Asia/Seoul")
    fun run() {
        purge.execute()
    }
}
