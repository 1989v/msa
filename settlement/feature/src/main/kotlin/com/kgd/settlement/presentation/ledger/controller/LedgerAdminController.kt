package com.kgd.settlement.presentation.ledger.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.settlement.application.ledger.usecase.GetTrialBalanceUseCase
import com.kgd.settlement.application.ledger.usecase.ReverseJournalUseCase
import com.kgd.settlement.presentation.ledger.dto.JournalResponse
import com.kgd.settlement.presentation.ledger.dto.ReverseJournalRequest
import com.kgd.settlement.presentation.ledger.dto.TrialBalanceResponse
import com.kgd.settlement.presentation.support.SettlementErrorResponses
import com.kgd.settlement.presentation.support.SettlementRequestIdentity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 어드민 원장 — 시산표(계정별 차 − 대, 전체 합 0) · 역분개(정정) */
@RestController
@RequestMapping("/api/v1/admin/settlements/ledger")
class LedgerAdminController(
    private val trialBalance: GetTrialBalanceUseCase,
    private val reverseJournal: ReverseJournalUseCase,
) {
    @GetMapping("/trial-balance")
    fun trialBalance(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
    ): ApiResponse<TrialBalanceResponse> {
        SettlementRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(TrialBalanceResponse.of(trialBalance.trialBalance()))
    }

    /** 거래 하나를 역분개한다. 같은 거래를 다시 요청하면 기존 역분개 거래를 돌려준다. 사유 필수(없으면 400) */
    @PostMapping("/journals/{id}/reverse")
    fun reverse(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
        @PathVariable id: Long,
        @RequestBody request: ReverseJournalRequest,
    ): ApiResponse<JournalResponse> {
        val actor = SettlementRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(JournalResponse.of(reverseJournal.reverse(id, actor, request.reason.orEmpty())))
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = SettlementErrorResponses.of(e)
}
