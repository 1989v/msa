package com.kgd.order.application.order.usecase

/** 보관 기한(24시간)이 지난 Idempotency-Key 정리. 지운 행 수 */
interface CleanupIdempotencyKeysUseCase {
    fun cleanup(): Int
}
