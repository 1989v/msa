package com.kgd.common.exception

import com.kgd.common.response.ApiResponse
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.ErrorResponse
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = KotlinLogging.logger {}

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        log.warn { "Business exception: ${e.errorCode} - ${e.message}" }
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
        log.warn { "Validation failed: $message" }
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

    /**
     * 읽을 수 없는 요청 본문(깨진 JSON, 타입 불일치, 본문 누락)은 클라이언트 잘못이므로 400 이다.
     *
     * `MethodArgumentNotValidException` 과 달리 이 예외는 `ErrorResponse` 구현체가 아니라
     * generic catch 로 흘러 500 이 됐다 — 없는 경로가 500 이던 것과 같은 계열의 결함.
     * 원인 메시지는 파서 내부 구조·클래스명을 노출하므로 응답에 싣지 않는다.
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadableBody(e: HttpMessageNotReadableException): ResponseEntity<ApiResponse<Nothing>> {
        log.warn { "Unreadable request body: ${e.mostSpecificCause.javaClass.simpleName}" }
        return ResponseEntity.badRequest().body(
            ApiResponse.error("INVALID_INPUT", "요청 본문을 읽을 수 없습니다")
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleGenericException(e: Exception): ResponseEntity<ApiResponse<Nothing>> {
        if (e is ErrorResponse) return handleSpringErrorResponse(e)
        log.error(e) { "Unhandled exception" }
        return ResponseEntity.internalServerError().body(ApiResponse.error(ErrorCode.INTERNAL_ERROR))
    }

    /**
     * Spring 이 스스로 상태코드를 실어 던지는 예외를 그 상태코드 그대로 통과시킨다.
     *
     * 매핑 없는 경로(`NoResourceFoundException` / `NoHandlerFoundException`), 미지원 메서드
     * (`HttpRequestMethodNotSupportedException`), `ResponseStatusException` 등이 모두
     * `ErrorResponse` 구현체다. 이들을 잡지 않으면 generic catch 로 흘러 404/405/403 이 500 이 된다.
     * 예외 타입을 하나씩 나열하는 대신 인터페이스로 한 번에 처리한다 — `ErrorResponse` 는 Throwable 이
     * 아니라 `@ExceptionHandler` 대상 타입이 될 수 없으므로 generic 핸들러 안에서 분기한다.
     *
     * 본문은 Spring 의 `ProblemDetail`(detail 에 요청 경로가 담긴다) 대신 기존 `ApiResponse` 포맷과
     * [ErrorCode] 어휘만 사용한다 — 응답 포맷을 유지하면서 경로·클래스명 노출도 막는다.
     */
    private fun <T> handleSpringErrorResponse(e: T): ResponseEntity<ApiResponse<Nothing>>
        where T : Throwable, T : ErrorResponse {
        val status = e.statusCode
        if (status.is5xxServerError) {
            log.error(e) { "Server error ${status.value()}: ${e.javaClass.simpleName}" }
        } else {
            log.warn { "Client error ${status.value()}: ${e.javaClass.simpleName}" }
        }
        return ResponseEntity.status(status)
            // 405 의 Allow, 415 의 Accept 처럼 상태코드에 규격상 딸린 헤더를 보존한다.
            .headers(e.headers)
            .body(ApiResponse.error(toErrorCode(status)))
    }

    private fun toErrorCode(status: HttpStatusCode): ErrorCode = when {
        status.value() == HttpStatus.NOT_FOUND.value() -> ErrorCode.NOT_FOUND
        status.value() == HttpStatus.UNAUTHORIZED.value() -> ErrorCode.UNAUTHORIZED
        status.value() == HttpStatus.FORBIDDEN.value() -> ErrorCode.FORBIDDEN
        status.is4xxClientError -> ErrorCode.INVALID_INPUT
        else -> ErrorCode.INTERNAL_ERROR
    }
}
