package com.kgd.sevensplit.presentation.dto

import java.math.BigDecimal

/**
 * DashboardOverview — `GET /api/v1/dashboard/overview` 응답.
 *
 * Phase 1 은 백테스트 실행 결과 요약만 노출한다 (실매매/페이퍼 지표는 Phase 2/3).
 *
 * ## 필드
 *  - `totalRuns` : 테넌트 내 완료된 백테스트 건수.
 *  - `totalRealizedPnl` : 완료된 run 들의 실현 PnL 합 (절대값 아님 — 음수 가능).
 */
data class DashboardOverview(
    val totalRuns: Int,
    val totalRealizedPnl: BigDecimal
)
