package com.kgd.quant.presentation.exception

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.live.PlaceLiveOrderUseCase
import com.kgd.quant.application.port.exchange.ExchangeException
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * QuantPhase3ExceptionHandler — Phase 3 신규 예외 → ApiResponse 매핑 (ADR-0037 / TG-P3-35).
 *
 * 공통 [GlobalExceptionHandler] 보다 먼저 매핑되어야 하므로 Order(LOWEST_PRECEDENCE - 1).
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE - 1)
class QuantPhase3ExceptionHandler {

    @ExceptionHandler(PlaceLiveOrderUseCase.OrderRejectedByGate::class)
    fun handleOrderRejected(ex: PlaceLiveOrderUseCase.OrderRejectedByGate): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ApiResponse.error("ORDER_REJECTED_BY_GATE", "${ex.reason.name}: ${ex.message}"))

    @ExceptionHandler(ExchangeException.RateLimited::class)
    fun handleRateLimited(ex: ExchangeException.RateLimited): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .body(ApiResponse.error("EXCHANGE_RATE_LIMITED", ex.message ?: "rate limited"))

    @ExceptionHandler(ExchangeException.InsufficientBalance::class)
    fun handleInsufficient(ex: ExchangeException.InsufficientBalance): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
            .body(ApiResponse.error("INSUFFICIENT_BALANCE", ex.message ?: "insufficient balance"))

    @ExceptionHandler(ExchangeException.InvalidCredential::class)
    fun handleInvalidCred(ex: ExchangeException.InvalidCredential): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ApiResponse.error("EXCHANGE_INVALID_CREDENTIAL", ex.message ?: "invalid credential"))

    @ExceptionHandler(ExchangeException.RejectedByExchange::class)
    fun handleRejected(ex: ExchangeException.RejectedByExchange): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ApiResponse.error("EXCHANGE_REJECTED:${ex.code}", ex.message ?: "rejected"))

    @ExceptionHandler(ExchangeException.TransientNetwork::class)
    fun handleTransient(ex: ExchangeException.TransientNetwork): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ApiResponse.error("EXCHANGE_TRANSIENT", ex.message ?: "transient network"))
}
