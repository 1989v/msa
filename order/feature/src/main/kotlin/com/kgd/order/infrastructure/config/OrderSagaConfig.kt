package com.kgd.order.infrastructure.config

import com.kgd.order.domain.saga.model.SagaTiming
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Duration

/**
 * 사가 기한 정책 (스펙 SR-4). 피벗 전 10분 + 결제 미상 재조회 최대 10분이 재고·혜택 보류 30분(`commerce.hold-minutes`)보다 짧아야 한다.
 */
@Configuration
class OrderSagaConfig {
    @Bean
    fun orderSagaTiming(
        @Value("\${order.saga.step-timeout-seconds:60}") stepTimeoutSeconds: Long,
        @Value("\${order.saga.pre-pivot-minutes:10}") prePivotMinutes: Long,
        @Value("\${order.saga.max-retries:10}") maxRetries: Int,
    ): SagaTiming = SagaTiming(Duration.ofSeconds(stepTimeoutSeconds), Duration.ofMinutes(prePivotMinutes), maxRetries)
}
