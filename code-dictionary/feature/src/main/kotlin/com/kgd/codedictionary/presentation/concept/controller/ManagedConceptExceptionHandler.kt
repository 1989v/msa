package com.kgd.codedictionary.presentation.concept.controller

import com.kgd.codedictionary.domain.concept.exception.ManagedConceptException
import com.kgd.common.response.ApiResponse
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * 온톨로지 파일이 관리하는 개념의 수정·삭제를 409 로 낸다.
 *
 * common 의 에러 코드에 CONFLICT 를 더하면 전 JVM 이미지가 다시 구워지므로 여기서 매핑한다(ADR-0100).
 * 공통 처리기보다 먼저 잡혀야 400 으로 떨어지지 않는다.
 */
@RestControllerAdvice(basePackages = ["com.kgd.codedictionary"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class ManagedConceptExceptionHandler {
    private val log = KotlinLogging.logger {}

    @ExceptionHandler(ManagedConceptException::class)
    fun handle(e: ManagedConceptException): ResponseEntity<ApiResponse<Nothing>> {
        log.warn { "관리 개념 쓰기 거부: ${e.message}" }
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error("CONFLICT", e.message ?: "managed concept"))
    }
}
