package com.kgd.settlement.presentation.statement.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.settlement.application.statement.usecase.GetStatementsUseCase
import com.kgd.settlement.presentation.statement.dto.StatementResponse
import com.kgd.settlement.presentation.support.SettlementErrorResponses
import com.kgd.settlement.presentation.support.SettlementRequestIdentity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 판매자 포털 정산서 — 게이트웨이 ROLE_SELLER + 서비스가 매 요청 `X-User-Id` 의 ACTIVE 판매자 행을 본다(정지 즉시 403).
 * 자기 판매자 id 의 정산서만(남의 것은 404).
 */
@RestController
@RequestMapping("/api/v1/seller/settlements")
class SellerSettlementController(
    private val statements: GetStatementsUseCase,
) {
    @GetMapping
    fun list(@RequestHeader("X-User-Id", required = false) userId: String?): ApiResponse<List<StatementResponse>> =
        ApiResponse.success(statements.forSeller(SettlementRequestIdentity.requireUser(userId)).map { StatementResponse.of(it, withLines = false) })

    @GetMapping("/{statementId}")
    fun detail(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @PathVariable statementId: Long,
    ): ApiResponse<StatementResponse> =
        ApiResponse.success(StatementResponse.of(statements.forSellerDetail(SettlementRequestIdentity.requireUser(userId), statementId), withLines = true))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = SettlementErrorResponses.of(e)
}
