package com.kgd.common.exception

import com.kgd.common.response.ApiResponse
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        log.warn("Business exception: ${e.errorCode} - ${e.message}")
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.INVALID_INPUT, ErrorCode.DUPLICATE_RESOURCE,
            ErrorCode.INSUFFICIENT_STOCK, ErrorCode.INVALID_ORDER_STATUS,
            ErrorCode.INVALID_PRODUCT_STATUS -> HttpStatus.BAD_REQUEST
            ErrorCode.CIRCUIT_BREAKER_OPEN, ErrorCode.EXTERNAL_API_ERROR -> HttpStatus.SERVICE_UNAVAILABLE
            ErrorCode.TIMEOUT -> HttpStatus.GATEWAY_TIMEOUT
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ApiResponse<Nothing>> {
        val message = e.bindingResult.fieldErrors
            .firstOrNull()
            ?.let { "${it.field}: ${it.defaultMessage}" }
            ?: "Validation failed"
        log.warn("Validation failed: $message")
        return ResponseEntity.badRequest().body(
            ApiResponse.error("INVALID_INPUT", message)
        )
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun handleTypeMismatch(e: MethodArgumentTypeMismatchException): ResponseEntity<ApiResponse<Nothing>> {
        return ResponseEntity.badRequest().body(
            ApiResponse.error("INVALID_INPUT", "파라미터 타입이 올바르지 않습니다: ${e.name}")
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleGenericException(e: Exception): ResponseEntity<ApiResponse<Nothing>> {
        log.error("Unhandled exception", e)
        return ResponseEntity.internalServerError().body(ApiResponse.error(ErrorCode.INTERNAL_ERROR))
    }
}
