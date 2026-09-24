package com.kgd.ads.presentation.support

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * ads 컨트롤러의 거절 사유를 화면까지 내려보낸다. 공용 `GlobalExceptionHandler` 는 [BusinessException] 의 문구를 버리고
 * 오류 코드의 기본 문구만 주는데, 광고주는 저장 불변식(최저가·예산·지면·이미지·충전 한도)을 문구로만 알 수 있다.
 *
 * 범위는 `com.kgd.ads` 컨트롤러뿐이다 — 같은 JVM 의 recommendation·experiment 응답은 그대로 공용 핸들러가 만든다.
 * 문구를 싣는 것은 ads 가 던지는 클라이언트 오류(400·401·403·404)뿐이고 상태 코드는 공용 핸들러와 같다.
 * ads 의 예외 문구는 사용자에게 보이는 한국어로 쓴다 — 내부 식별자·예외 원인은 싣지 않는다.
 * 그 밖의 예외(본문 파싱·경로 없음·500)는 공용 핸들러로 넘어간다.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = ["com.kgd.ads"])
class AdsExceptionHandler {

    private val log = KotlinLogging.logger {}

    @ExceptionHandler(BusinessException::class)
    fun handleBusiness(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = CLIENT_ERRORS[e.errorCode]
        if (status == null) {
            log.error(e) { "ads 서버 오류: ${e.errorCode}" }
            return ResponseEntity.internalServerError().body(ApiResponse.error(ErrorCode.INTERNAL_ERROR))
        }
        log.warn { "ads 요청 거절: ${e.errorCode} - ${e.message}" }
        val message = e.message?.takeIf { it.isNotBlank() } ?: e.errorCode.message
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode.name, message))
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(e: MethodArgumentNotValidException): ResponseEntity<ApiResponse<Nothing>> {
        val message = e.bindingResult.fieldErrors.firstOrNull()?.let(::describe) ?: "입력값이 올바르지 않습니다"
        log.warn { "ads 입력 검증 실패: $message" }
        return ResponseEntity.badRequest().body(ApiResponse.error("INVALID_INPUT", message))
    }

    /** 제약 이름으로 한국어 문구를 고른다 — 기본 메시지는 JVM 로케일을 따라 영어로 나올 수 있다. 거절된 값은 싣지 않는다. */
    private fun describe(error: FieldError): String {
        val reason = when (error.code) {
            "NotBlank", "NotEmpty", "NotNull" -> "비어 있을 수 없습니다"
            "Positive" -> "0 보다 커야 합니다"
            "Size" -> "길이나 개수가 허용 범위를 벗어났습니다"
            "Pattern" -> "형식이 올바르지 않습니다"
            else -> "값이 올바르지 않습니다"
        }
        return "${error.field}: $reason"
    }

    private companion object {
        // ads 가 던지는 오류 코드와 그 상태. 공용 핸들러의 판정과 같게 둔다.
        val CLIENT_ERRORS = mapOf(
            ErrorCode.INVALID_INPUT to HttpStatus.BAD_REQUEST,
            ErrorCode.DUPLICATE_RESOURCE to HttpStatus.BAD_REQUEST,
            ErrorCode.UNAUTHORIZED to HttpStatus.UNAUTHORIZED,
            ErrorCode.FORBIDDEN to HttpStatus.FORBIDDEN,
            ErrorCode.NOT_FOUND to HttpStatus.NOT_FOUND,
        )
    }
}
