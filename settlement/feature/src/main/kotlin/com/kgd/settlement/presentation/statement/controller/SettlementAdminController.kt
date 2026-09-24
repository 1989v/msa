package com.kgd.settlement.presentation.statement.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.settlement.application.statement.usecase.GetStatementsUseCase
import com.kgd.settlement.application.statement.usecase.RetryPayoutUseCase
import com.kgd.settlement.application.statement.usecase.RunSettlementBatchUseCase
import com.kgd.settlement.domain.statement.model.StatementStatus
import com.kgd.settlement.presentation.statement.dto.BatchRunResponse
import com.kgd.settlement.presentation.statement.dto.StatementResponse
import com.kgd.settlement.presentation.support.SettlementErrorResponses
import com.kgd.settlement.presentation.support.SettlementRequestIdentity
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 어드민 정산 — 정산서 목록·상세 · 지급 재시도 · 배치 즉시 실행. 게이트웨이 ROLE_ADMIN + 서비스가 역할을 다시 본다 */
@RestController
@RequestMapping("/api/v1/admin/settlements")
class SettlementAdminController(
    private val statements: GetStatementsUseCase,
    private val retryPayout: RetryPayoutUseCase,
    private val batch: RunSettlementBatchUseCase,
) {
    private val log = KotlinLogging.logger {}

    @GetMapping("/statements")
    fun list(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
        @RequestParam(required = false) status: StatementStatus?,
        @RequestParam(required = false) sellerId: Long?,
    ): ApiResponse<List<StatementResponse>> {
        SettlementRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(statements.search(status, sellerId).map { StatementResponse.of(it, withLines = false) })
    }

    @GetMapping("/statements/{statementId}")
    fun detail(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
        @PathVariable statementId: Long,
    ): ApiResponse<StatementResponse> {
        SettlementRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(StatementResponse.of(statements.detail(statementId), withLines = true))
    }

    /** 확정됐는데 지급이 끝나지 않은(CONFIRMED) 정산서의 지급을 다시 한다. 그 밖의 상태는 409 */
    @PostMapping("/statements/{statementId}/retry-payout")
    fun retry(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
        @PathVariable statementId: Long,
    ): ApiResponse<StatementResponse> {
        val actor = SettlementRequestIdentity.requireAdmin(userId, roles)
        log.info { "지급 재시도: statement=$statementId, actor=$actor" }
        return ApiResponse.success(StatementResponse.of(retryPayout.retry(statementId), withLines = false))
    }

    /** 스케줄(05:30 KST)을 기다리지 않고 오늘 날짜로 배치를 돌린다 — 닫힌 기간만 정산하므로 열린 기간을 앞당기지 않는다 */
    @PostMapping("/batch/run")
    fun runBatch(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
    ): ApiResponse<BatchRunResponse> {
        val actor = SettlementRequestIdentity.requireAdmin(userId, roles)
        log.info { "정산 배치 수동 실행: actor=$actor" }
        return ApiResponse.success(BatchRunResponse.of(batch.run()))
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = SettlementErrorResponses.of(e)
}
