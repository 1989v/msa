package com.kgd.product.presentation.product.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ProductExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.INSUFFICIENT_STOCK -> HttpStatus.CONFLICT
            ErrorCode.INVALID_PRODUCT_STATUS -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ApiResponse<Nothing>> {
        val message = e.bindingResult.fieldErrors.firstOrNull()?.defaultMessage ?: "입력값이 올바르지 않습니다"
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.INVALID_INPUT.name, message))
    }
}
