package com.kgd.sevensplit.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.sevensplit.application.usecase.ListBacktestRunsQuery
import com.kgd.sevensplit.application.usecase.RunBacktestUseCase
import com.kgd.sevensplit.application.view.BacktestRunResultView
import com.kgd.sevensplit.application.view.BacktestRunSummaryView
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.presentation.dto.RunBacktestRequest
import com.kgd.sevensplit.presentation.resolver.TenantHeader
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * BacktestController — 백테스트 실행 및 조회 엔드포인트.
 *
 * - `POST /api/v1/backtests`                 : 백테스트 실행 요청 (동기). Phase 1 은 run 이
 *   짧으므로 동기 응답. 장시간 실행 대비 Phase 2 에서 async/status polling 으로 확장 예정.
 * - `GET  /api/v1/strategies/{id}/runs`      : 특정 전략의 완료된 run 목록.
 *
 * ## UseCase 경계
 * - `RunBacktestUseCase` 내부에서 외부 IO (ClickHouse) 가 트랜잭션 밖으로 분리되어 있다 (ADR-0020).
 *   컨트롤러는 별도 트랜잭션 어노테이션을 붙이지 않는다.
 */
@RestController
@RequestMapping("/api/v1")
class BacktestController(
    private val runBacktest: RunBacktestUseCase,
    private val listBacktestRuns: ListBacktestRunsQuery
) {

    @PostMapping("/backtests")
    suspend fun submit(
        @TenantHeader tenantId: TenantId,
        @Valid @RequestBody request: RunBacktestRequest
    ): ApiResponse<BacktestRunResultView> {
        val command = request.toCommand(tenantId)
        val result = runBacktest.execute(command)
        return ApiResponse.success(result)
    }

    @GetMapping("/strategies/{id}/runs")
    suspend fun listRuns(
        @TenantHeader tenantId: TenantId,
        @PathVariable id: String
    ): ApiResponse<List<BacktestRunSummaryView>> {
        val strategyId = StrategyId.of(id)
        val views = listBacktestRuns.execute(tenantId, strategyId)
        return ApiResponse.success(views)
    }
}
