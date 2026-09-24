package com.kgd.ads.infrastructure.scheduling

import com.kgd.ads.application.settlement.usecase.RunSettlementUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 카운터 → 시간별 집계 → 정산, 5분마다. 한 실행이 멈췄던 시간을 모두 따라잡으므로 놓친 실행을 따로 채우지 않는다.
 * replicas 1 전제다 — 두 파드가 같은 시각을 동시에 닫으려 하면 닫힘 기록의 유일 키가 한쪽을 되돌린다.
 */
@Component
@ConditionalOnProperty(prefix = "ads.scheduling", name = ["enabled"], havingValue = "true", matchIfMissing = true)
class SettlementJob(
    private val runSettlement: RunSettlementUseCase,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(initialDelay = INITIAL_DELAY_MS, fixedDelay = INTERVAL_MS)
    fun run() {
        try {
            runSettlement.run()
        } catch (e: RuntimeException) {
            log.error(e) { "광고 집계·정산 실행 실패 — 다음 주기에 다시 한다" }
        }
    }

    companion object {
        const val INTERVAL_MS = 5 * 60_000L
        const val INITIAL_DELAY_MS = 60_000L
    }
}
