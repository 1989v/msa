package com.kgd.ads.application.ledger.usecase

import java.time.LocalDateTime

/** 전체 분개 합이 0 인지 검사한다. 어긋나면 ERROR 로그와 메트릭으로 알린다. 매일 한 번, 어드민 조회용으로도 부른다. */
interface CheckLedgerUseCase {
    fun check(): Result

    data class Result(val imbalanceMicros: Long, val checkedAt: LocalDateTime) {
        val balanced: Boolean get() = imbalanceMicros == 0L
    }
}
