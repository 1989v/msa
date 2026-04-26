package com.kgd.sevensplit.application.port.notification

import com.kgd.sevensplit.domain.common.TenantId

/**
 * NotificationSender — 외부 알림 발송 port.
 *
 * ## 배치 위치
 * Application 레이어. Phase 2 에서 Telegram Bot 어댑터로 구현 (TG-04.8).
 *
 * ## 계약
 * - `send` 는 실패 시 예외 대신 [SendResult.Failure] 를 반환해 UseCase 가 재시도 여부를
 *   결정할 수 있게 한다 (ADR-0015 DLQ 연동 지점).
 * - 구현체는 Rate Limiting / 채널별 포맷팅을 책임진다.
 */
interface NotificationSender {
    suspend fun send(tenantId: TenantId, event: NotificationEvent): SendResult
}

/**
 * NotificationEvent — 알림 대상 이벤트. 도메인 이벤트와는 별도 (presentation 용).
 *
 * Phase 1 skeleton — Phase 2 에서 Telegram template 과 1:1 매핑된다.
 */
sealed interface NotificationEvent {
    data class OrderFilled(
        val symbol: String,
        val side: String,
        val price: String,
        val quantity: String
    ) : NotificationEvent

    data class RiskLimitBreached(
        val limitType: String,
        val value: String
    ) : NotificationEvent

    data class EmergencyLiquidation(
        val reason: String
    ) : NotificationEvent

    data class StrategyLifecycle(
        val strategyId: String,
        val transition: String
    ) : NotificationEvent
}

/** 발송 결과. `Failure.retryable` 이 true 이면 UseCase/infra 재시도 후보. */
sealed interface SendResult {
    data object Success : SendResult
    data class Failure(val reason: String, val retryable: Boolean) : SendResult
}
