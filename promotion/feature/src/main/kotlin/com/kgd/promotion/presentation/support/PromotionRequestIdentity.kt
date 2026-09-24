package com.kgd.promotion.presentation.support

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity

/**
 * 게이트웨이가 채운 신원 헤더 해석. 헤더가 없으면 허용으로 떨어지지 않고 401 이다 — 남의 쿠폰·포인트를 돌려주지 않는다.
 * 역할은 게이트웨이가 먼저 보지만 어드민 API 는 서비스도 다시 본다.
 */
internal object PromotionRequestIdentity {
    fun requireUser(userId: String?): String =
        userId?.trim()?.takeIf { it.isNotEmpty() } ?: throw UnauthorizedException("X-User-Id 가 없습니다")

    fun requireAdmin(userId: String?, roles: String?): String {
        val id = requireUser(userId)
        if ("ROLE_ADMIN" !in roles.orEmpty().split(',').map { it.trim() }) throw ForbiddenException("ROLE_ADMIN 이 필요합니다")
        return id
    }
}

/**
 * promotion 컨트롤러의 BusinessException → HTTP 상태. 컨트롤러 로컬 `@ExceptionHandler` 로 둔다 —
 * commerce 의 범위 없는 전역 advice(Product·OrderExceptionHandler)보다 먼저 적용된다.
 */
internal object PromotionErrorResponses {
    fun of(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.DUPLICATE_RESOURCE, ErrorCode.COUPON_SOLD_OUT, ErrorCode.INVALID_PROMOTION_STATUS,
            ErrorCode.INSUFFICIENT_POINTS -> HttpStatus.CONFLICT
            ErrorCode.INVALID_INPUT -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }

    fun badRequest(): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(ErrorCode.INVALID_INPUT))
}
