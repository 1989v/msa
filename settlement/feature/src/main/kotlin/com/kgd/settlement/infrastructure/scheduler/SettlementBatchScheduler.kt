package com.kgd.settlement.infrastructure.scheduler

import com.kgd.settlement.application.statement.usecase.RunSettlementBatchUseCase
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** 정산 배치 — 매일 05:30 KST (PG 대사 05:10 뒤). 호스트 스케줄러 풀(4)을 써 아웃박스 릴레이를 막지 않는다 */
@Component
class SettlementBatchScheduler(
    private val batch: RunSettlementBatchUseCase,
) {
    @Scheduled(cron = "\${settlement.batch.cron:0 30 5 * * *}", zone = "Asia/Seoul")
    fun run() {
        batch.run()
    }
}
