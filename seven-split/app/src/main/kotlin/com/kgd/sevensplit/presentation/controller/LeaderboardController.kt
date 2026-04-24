package com.kgd.sevensplit.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.sevensplit.application.exception.NotImplementedInPhase1Exception
import com.kgd.sevensplit.application.usecase.LeaderboardQuery
import com.kgd.sevensplit.application.view.LeaderboardEntry
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.presentation.resolver.TenantHeader
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * LeaderboardController — 테넌트 내부 리더보드.
 *
 * - `GET  /api/v1/leaderboard`          : 실현 PnL 절대값 기준 내림차순 상위 N 개.
 * - `POST /api/v1/leaderboard/compare`  : Phase 2+ 전략 비교 기능 (현재 501).
 *
 * ## 산식 (OQ-010 잠정)
 * Phase 1 은 `realizedPnl.abs()` 정렬. MDD/Sharpe 가 추가되면 가중합 점수로 교체.
 */
@RestController
@RequestMapping("/api/v1/leaderboard")
class LeaderboardController(
    private val leaderboard: LeaderboardQuery
) {

    @GetMapping
    suspend fun rank(
        @TenantHeader tenantId: TenantId,
        @RequestParam(defaultValue = "10") @Min(1) @Max(100) limit: Int
    ): ApiResponse<List<LeaderboardEntry>> {
        val entries = leaderboard.execute(tenantId, limit)
        return ApiResponse.success(entries)
    }

    /**
     * 전략 비교 — Phase 1 에서는 501.
     *
     * 비교 요청 스키마와 집계 규칙이 Phase 2 확정 예정. 지금 정의해 두면 shape 변경 비용이 큼.
     */
    @PostMapping("/compare")
    suspend fun compare(
        @TenantHeader tenantId: TenantId
    ): ApiResponse<Unit> {
        throw NotImplementedInPhase1Exception(
            "POST /api/v1/leaderboard/compare — Phase 2"
        )
    }
}
