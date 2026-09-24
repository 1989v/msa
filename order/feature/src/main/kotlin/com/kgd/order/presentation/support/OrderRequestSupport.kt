package com.kgd.order.presentation.support

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.UnauthorizedException
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity

/**
 * 게이트웨이가 채운 `X-User-Id` 해석. 헤더가 없으면 허용으로 떨어지지 않고 401 이다 — 남의 장바구니·주문서를 돌려주지 않는다.
 */
internal object OrderRequestIdentity {
    fun requireUser(userId: String?): String =
        userId?.trim()?.takeIf { it.isNotEmpty() } ?: throw UnauthorizedException("X-User-Id 가 없습니다")
}

/**
 * 장바구니·주문서·주문 컨트롤러의 예외 → HTTP 상태. 컨트롤러 로컬 `@ExceptionHandler` 로 둔다 —
 * commerce 의 범위 없는 전역 advice(Product·OrderExceptionHandler)는 422 를 모른다.
 */
internal object OrderSheetErrorResponses {
    fun of(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.ORDER_SHEET_UNAVAILABLE -> HttpStatus.UNPROCESSABLE_CONTENT
            ErrorCode.ORDER_CANCEL_NOT_ALLOWED, ErrorCode.IDEMPOTENCY_KEY_IN_PROGRESS -> HttpStatus.CONFLICT
            ErrorCode.TOO_MANY_PENDING_ORDERS -> HttpStatus.TOO_MANY_REQUESTS
            ErrorCode.INVALID_INPUT -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode.name, e.message ?: e.errorCode.message))
    }

    fun badRequest(message: String?): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(ErrorCode.INVALID_INPUT.name, message ?: ErrorCode.INVALID_INPUT.message))
}
