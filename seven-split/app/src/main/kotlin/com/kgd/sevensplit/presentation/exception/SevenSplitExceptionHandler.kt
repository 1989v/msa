package com.kgd.sevensplit.presentation.exception

import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.sevensplit.application.exception.NotImplementedInPhase1Exception
import com.kgd.sevensplit.domain.exception.IllegalSlotTransitionException
import com.kgd.sevensplit.domain.exception.IllegalStrategyTransitionException
import com.kgd.sevensplit.domain.exception.LeverageAttemptException
import com.kgd.sevensplit.domain.exception.SplitStrategyConfigInvalidException
import com.kgd.sevensplit.domain.exception.StopLossAttemptException
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

private val logger = KotlinLogging.logger {}

/**
 * SevenSplitExceptionHandler — seven-split 서비스 전용 추가 예외 매핑.
 *
 * ## 위치
 * [com.kgd.common.exception.GlobalExceptionHandler] 가 `BusinessException` 을 일괄 처리하므로
 * 본 handler 는 common 에서 다루지 않는 다음 범주만 커버한다.
 *
 *  - 도메인 invariant 위반으로 분류가 애매한 예외: `SplitStrategyConfigInvalidException`,
 *    `IllegalStrategyTransitionException`, `IllegalSlotTransitionException`,
 *    `StopLossAttemptException`, `LeverageAttemptException`
 *    → 각기 400/409/500 에 세밀 매핑해 Phase 1 운영 가시성을 확보한다.
 *  - `NotImplementedInPhase1Exception` → 501 Not Implemented.
 *  - `MissingRequestHeaderException` (`X-User-Id` 누락) → 400 BAD_REQUEST.
 *
 * common handler 와 겹치는 핸들러가 있으면 `@Order(HIGHEST_PRECEDENCE)` 로 본 advice 를 우선.
 *
 * ## 로깅 (ADR-0021)
 * kotlin-logging 람다 형식. 비즈니스 invariant 위반은 `warn`, 서버측 invariant 위반
 * (`StopLossAttemptException`) 은 `error` 로 구분한다.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class SevenSplitExceptionHandler {

    /**
     * INV-07 전략 설정 불변식 위반 → 400.
     *
     * common handler 는 `BusinessException` 을 `INVALID_INPUT` 으로 잡아 이미 400 을 내지만,
     * 세부 코드 문자열을 `SEVEN_SPLIT_CONFIG_INVALID` 로 치환해 클라이언트가 세부 원인을
     * 구분할 수 있게 한다.
     */
    @ExceptionHandler(SplitStrategyConfigInvalidException::class)
    fun handleConfigInvalid(
        e: SplitStrategyConfigInvalidException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn { "SplitStrategyConfig invariant violation: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error("SEVEN_SPLIT_CONFIG_INVALID", e.message ?: "Config invalid"))
    }

    /**
     * 상태머신 전이 가드 실패 → 409 Conflict.
     *
     * "현재 상태 때문에 해당 전이는 불가" 이므로 `INVALID_INPUT` 보다 409 가 의미에 부합한다.
     */
    @ExceptionHandler(IllegalStrategyTransitionException::class)
    fun handleStrategyTransition(
        e: IllegalStrategyTransitionException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn { "Illegal StrategyStatus transition: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(ApiResponse.error("SEVEN_SPLIT_ILLEGAL_STRATEGY_TRANSITION", e.message ?: "Illegal transition"))
    }

    @ExceptionHandler(IllegalSlotTransitionException::class)
    fun handleSlotTransition(
        e: IllegalSlotTransitionException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn { "Illegal RoundSlotState transition: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(ApiResponse.error("SEVEN_SPLIT_ILLEGAL_SLOT_TRANSITION", e.message ?: "Illegal slot transition"))
    }

    /**
     * INV-02 stop-loss 시도 → 500.
     *
     * 사용자 입력이 아니라 엔진 내부 invariant 위반이다. 발생 자체가 버그이므로
     * error 로그 + 500 으로 응답한다.
     */
    @ExceptionHandler(StopLossAttemptException::class)
    fun handleStopLoss(
        e: StopLossAttemptException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.error(e) { "INV-02 stop-loss invariant violated: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error("SEVEN_SPLIT_STOP_LOSS_ATTEMPT", e.message ?: "Stop-loss attempt"))
    }

    /**
     * 원칙 2 레버리지 시도 → 500. 도메인 차원에서 컴파일 금지되어야 하지만 혹시 누출되면 즉시 차단.
     */
    @ExceptionHandler(LeverageAttemptException::class)
    fun handleLeverage(
        e: LeverageAttemptException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.error(e) { "Leverage attempt detected: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error("SEVEN_SPLIT_LEVERAGE_FORBIDDEN", e.message ?: "Leverage forbidden"))
    }

    /**
     * Phase 1 미구현 기능 호출 → 501 Not Implemented.
     */
    @ExceptionHandler(NotImplementedInPhase1Exception::class)
    fun handleNotImplemented(
        e: NotImplementedInPhase1Exception
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn { "Phase 1 not-implemented feature invoked: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.NOT_IMPLEMENTED)
            .body(ApiResponse.error("SEVEN_SPLIT_NOT_IMPLEMENTED_PHASE1", e.message ?: "Not implemented"))
    }

    /**
     * `X-User-Id` 헤더 누락 → 400. Gateway 미경유 요청을 빠르게 거절.
     */
    @ExceptionHandler(MissingRequestHeaderException::class)
    fun handleMissingHeader(
        e: MissingRequestHeaderException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn { "Missing request header: ${e.headerName}" }
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(
                ApiResponse.error(
                    ErrorCode.INVALID_INPUT.name,
                    "Missing required header: ${e.headerName}"
                )
            )
    }

    /**
     * DTO 매핑 시 `IllegalArgumentException` (예: 잘못된 `executionMode` 값) → 400.
     *
     * UseCase / 도메인에서 명시적으로 던지는 것이 아닌, request DTO 의 방어 코드가 던지는 경우만
     * 잡는다. 가능하면 `BusinessException` 을 사용하고 이 handler 는 Phase 1 fallback 용.
     */
    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(
        e: IllegalArgumentException
    ): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn { "Illegal argument: ${e.message}" }
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(ErrorCode.INVALID_INPUT.name, e.message ?: "Invalid argument"))
    }
}
