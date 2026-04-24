package com.kgd.sevensplit.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.sevensplit.application.usecase.ListBacktestRunsQuery
import com.kgd.sevensplit.application.view.BacktestRunSummaryView
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.presentation.dto.DashboardOverview
import com.kgd.sevensplit.presentation.resolver.TenantHeader
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal

/**
 * DashboardController — Phase 1 대시보드.
 *
 * 실시간 페이퍼/실매매 지표는 Phase 2/3 범위이므로, Phase 1 은 백테스트 결과만 노출한다.
 *
 * - `GET /api/v1/dashboard/overview`    : 테넌트 내 완료 백테스트 총 건수 + 실현 PnL 합.
 * - `GET /api/v1/dashboard/executions`  : 테넌트 내 완료 백테스트 실행 리스트.
 *
 * ## 집계 방식
 * Phase 1 은 `ListBacktestRunsQuery` 결과를 그대로 가공한다. 집계 성능 이슈는 Phase 2 에서
 * ClickHouse 집계 쿼리로 교체한다.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
class DashboardController(
    private val listBacktestRuns: ListBacktestRunsQuery
) {

    @GetMapping("/overview")
    suspend fun overview(
        @TenantHeader tenantId: TenantId
    ): ApiResponse<DashboardOverview> {
        val runs = listBacktestRuns.execute(tenantId, null)
        val totalPnl = runs.fold(BigDecimal.ZERO) { acc, r -> acc.add(r.realizedPnl) }
        return ApiResponse.success(
            DashboardOverview(
                totalRuns = runs.size,
                totalRealizedPnl = totalPnl
            )
        )
    }

    @GetMapping("/executions")
    suspend fun executions(
        @TenantHeader tenantId: TenantId
    ): ApiResponse<List<BacktestRunSummaryView>> {
        val runs = listBacktestRuns.execute(tenantId, null)
        return ApiResponse.success(runs)
    }
}
