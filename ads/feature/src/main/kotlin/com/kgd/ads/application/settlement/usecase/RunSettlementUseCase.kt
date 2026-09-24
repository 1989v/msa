package com.kgd.ads.application.settlement.usecase

import java.time.LocalDateTime

/**
 * 카운터 → 시간별 집계 → 정산을 한 번 돈다. 5분 주기 작업이 부르고, 테스트는 직접 부른다.
 * 몇 번을 돌려도, 몇 시간을 건너뛰고 돌려도 결과가 같다.
 */
interface RunSettlementUseCase {
    fun run(): Result

    data class Result(
        /** 이번 실행에서 덮어쓴 시각 */
        val aggregatedHours: List<LocalDateTime>,
        /** 덮어쓰기에 실패해 닫지 않은 시각 */
        val failedHours: List<LocalDateTime>,
        /** 이번 실행에서 닫은 시각 */
        val closedHours: List<LocalDateTime>,
        /** 정산한 (캠페인, 시각) 수 — 청구 0 포함 */
        val settled: Int,
        val settlementFailures: Int,
        /** 빈틈없이 닫힌 마지막 시각 */
        val closedThrough: LocalDateTime,
    )
}
