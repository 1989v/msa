package com.kgd.common.ops

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import com.kgd.common.ops.usecase.OpsIssuePageView
import com.kgd.common.ops.usecase.OpsIssueView
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestParam

/**
 * `/api/v1/admin/{domain}/ops-issues` 의 공통 동작. 도메인 컨트롤러가 이 클래스를 상속하고 경로(`@RequestMapping`)만 붙인다 —
 * 여덟 도메인의 응답 모양과 권한 판정이 한 곳에서 같다. 게이트웨이가 ROLE_ADMIN 을 보지만 서비스도 신원 헤더를 다시 본다.
 * 예외는 여기서 HTTP 상태로 바꾼다 — commerce 의 범위 없는 전역 advice 보다 컨트롤러 로컬 핸들러가 먼저다.
 */
abstract class OpsIssueAdminEndpoints(
    private val useCase: OpsIssueAdminUseCase,
) {
    @GetMapping
    fun list(
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) type: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OpsIssuePageView> {
        requireAdmin(userId, roles)
        return ApiResponse.success(useCase.list(status, type, page, size))
    }

    @PostMapping("/{id}/retry")
    fun retry(
        @PathVariable id: Long,
        @RequestBody(required = false) request: OpsIssueActionRequest?,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OpsIssueView> {
        val actor = requireAdmin(userId, roles)
        return ApiResponse.success(useCase.retry(id, actor, request?.reason?.takeIf { it.isNotBlank() }))
    }

    @PostMapping("/{id}/close")
    fun close(
        @PathVariable id: Long,
        @RequestBody request: OpsIssueActionRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OpsIssueView> {
        val actor = requireAdmin(userId, roles)
        val reason = request.reason?.trim()?.takeIf { it.isNotEmpty() && it.length <= 500 }
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "종결 사유(1~500자)가 필요합니다")
        return ApiResponse.success(useCase.close(id, actor, reason))
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.INVALID_OPS_ISSUE_STATUS -> HttpStatus.CONFLICT
            ErrorCode.INVALID_INPUT -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode.name, e.message ?: e.errorCode.message))
    }

    private fun requireAdmin(userId: String?, roles: String?): String {
        val id = userId?.trim()?.takeIf { it.isNotEmpty() } ?: throw UnauthorizedException("X-User-Id 가 없습니다")
        if ("ROLE_ADMIN" !in roles.orEmpty().split(',').map { it.trim() }) throw ForbiddenException("ROLE_ADMIN 이 필요합니다")
        return id
    }
}

data class OpsIssueActionRequest(val reason: String? = null)
