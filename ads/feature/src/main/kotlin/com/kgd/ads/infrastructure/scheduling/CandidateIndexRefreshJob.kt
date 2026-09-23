package com.kgd.ads.infrastructure.scheduling

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 후보 인덱스 주기 갱신 — 승인·정지·반려·매핑 변경이 1분 안에 결정에 반영되게 30초마다.
 * 기동 직후 바로 한 번 돈다(그 전까지 결정은 유료 광고 없이 응답한다).
 * 실패해도 이전 인덱스로 계속 결정하고, 다음 주기에 다시 시도한다.
 */
@Component
@ConditionalOnProperty(prefix = "ads.scheduling", name = ["enabled"], havingValue = "true", matchIfMissing = true)
class CandidateIndexRefreshJob(
    private val refreshCandidateIndex: RefreshCandidateIndexUseCase,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(initialDelay = 0, fixedDelay = REFRESH_INTERVAL_MS)
    fun run() {
        try {
            refreshCandidateIndex.refresh()
        } catch (e: RuntimeException) {
            log.error(e) { "광고 후보 인덱스 갱신 실패 — 이전 인덱스로 계속 결정한다" }
        }
    }

    companion object {
        const val REFRESH_INTERVAL_MS = 30_000L
    }
}
