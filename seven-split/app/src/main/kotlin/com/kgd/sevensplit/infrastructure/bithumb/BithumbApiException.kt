package com.kgd.sevensplit.infrastructure.bithumb

/**
 * TG-07: 빗썸 Public API 호출 실패를 나타내는 예외.
 *
 * - HTTP 4xx/5xx, 네트워크 타임아웃, status 필드가 "0000" 이 아닌 케이스 등을 감싼다.
 * - 호출자는 이 예외를 잡아 DLQ 기록 / 재시도 여부를 판단한다.
 */
class BithumbApiException(
    message: String,
    cause: Throwable? = null,
    val status: String? = null,
) : RuntimeException(message, cause)
