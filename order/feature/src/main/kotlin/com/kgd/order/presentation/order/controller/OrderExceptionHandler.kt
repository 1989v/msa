package com.kgd.order.presentation.order.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * order 컨트롤러 전용. commerce 호스트에는 도메인이 여럿 폴드돼 있어, 범위 없이 두면 HIGHEST_PRECEDENCE 로
 * 다른 도메인의 BusinessException 까지 가로채 그 도메인의 상태코드 매핑을 덮는다.
 */
@RestControllerAdvice(basePackages = ["com.kgd.order"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class OrderExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.INVALID_ORDER_STATUS -> HttpStatus.BAD_REQUEST
            ErrorCode.EXTERNAL_API_ERROR -> HttpStatus.BAD_GATEWAY
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }
}
