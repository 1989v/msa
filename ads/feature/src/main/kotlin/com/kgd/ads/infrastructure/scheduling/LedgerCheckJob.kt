package com.kgd.ads.infrastructure.scheduling

import com.kgd.ads.application.ledger.usecase.CheckLedgerUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** 매일 KST 04:30 전체 분개 합 검사. 결과는 검사기가 로그·메트릭으로 남긴다. */
@Component
@ConditionalOnProperty(prefix = "ads.scheduling", name = ["enabled"], havingValue = "true", matchIfMissing = true)
class LedgerCheckJob(
    private val checkLedger: CheckLedgerUseCase,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Seoul")
    fun run() {
        try {
            checkLedger.check()
        } catch (e: RuntimeException) {
            log.error(e) { "광고 원장 검사 실행 실패" }
        }
    }
}
