package com.kgd.payment.presentation.opsissue.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.payment.application.opsissue.usecase.ManageOpsIssueUseCase
import com.kgd.payment.application.opsissue.usecase.OpsIssuePageView
import com.kgd.payment.application.opsissue.usecase.OpsIssueView
import com.kgd.payment.application.opsissue.usecase.QueryOpsIssuesUseCase
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import com.kgd.payment.presentation.opsissue.dto.CloseOpsIssueRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 결제 운영 이슈 (ROLE_ADMIN) — 결과 미상 소진 · 대사 불일치. 재시도·종결은 처리자를 남긴다. */
@RestController
@RequestMapping("/api/v1/admin/payments/ops-issues")
class PaymentOpsIssueAdminController(
    private val queryOpsIssuesUseCase: QueryOpsIssuesUseCase,
    private val manageOpsIssueUseCase: ManageOpsIssueUseCase,
) {
    @GetMapping
    fun list(
        @RequestParam(required = false) status: OpsIssueStatus?,
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OpsIssuePageView> {
        PaymentRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(queryOpsIssuesUseCase.list(status, page, size))
    }

    @PostMapping("/{id}/retry")
    fun retry(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OpsIssueView> {
        val actor = PaymentRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(manageOpsIssueUseCase.retry(id, actor))
    }

    @PostMapping("/{id}/close")
    fun close(
        @PathVariable id: Long,
        @Valid @RequestBody request: CloseOpsIssueRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OpsIssueView> {
        val actor = PaymentRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(manageOpsIssueUseCase.close(id, actor, request.reason))
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> = PaymentErrorResponses.of(e)
}
