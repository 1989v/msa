package com.kgd.settlement.presentation.ledger.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.settlement.application.ledger.usecase.GetTrialBalanceUseCase
import com.kgd.settlement.presentation.ledger.dto.TrialBalanceResponse
import com.kgd.settlement.presentation.support.SettlementErrorResponses
import com.kgd.settlement.presentation.support.SettlementRequestIdentity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 어드민 원장 — 시산표(계정별 차 − 대, 전체 합 0) */
@RestController
@RequestMapping("/api/v1/admin/settlements/ledger")
class LedgerAdminController(
    private val trialBalance: GetTrialBalanceUseCase,
) {
    @GetMapping("/trial-balance")
    fun trialBalance(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
    ): ApiResponse<TrialBalanceResponse> {
        SettlementRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(TrialBalanceResponse.of(trialBalance.trialBalance()))
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = SettlementErrorResponses.of(e)
}
