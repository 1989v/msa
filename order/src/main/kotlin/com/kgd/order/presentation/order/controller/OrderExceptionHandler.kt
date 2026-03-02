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

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class OrderExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.INVALID_ORDER_STATUS -> HttpStatus.BAD_REQUEST
            ErrorCode.EXTERNAL_API_ERROR -> HttpStatus.BAD_GATEWAY
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }
}
