package com.kgd.quant.infrastructure.resilience

import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Duration

/**
 * TG-P2-11.1 — Resilience4j CircuitBreaker 3종 등록 (ADR-0015 §1 표준 설정 적용).
 *
 * | 이름 | 적용 대상 |
 * |---|---|
 * | `bithumb-rest` | 빗썸 REST 호출 ([com.kgd.quant.infrastructure.stream.BithumbRestFallbackPoller]) |
 * | `bithumb-ws-reconnect` | 빗썸 WebSocket 재연결 ([com.kgd.quant.infrastructure.stream.BithumbWebSocketSubscriber]) |
 * | `telegram-bot` | 텔레그램 Bot API ([com.kgd.quant.infrastructure.notification.TelegramBotNotificationSender]) |
 *
 * ## 설정 (ADR-0015 §1)
 * - `failureRateThreshold = 50%`
 * - `slidingWindowType = COUNT_BASED`, `slidingWindowSize = 20`
 * - `waitDurationInOpenState = 30s`
 * - `permittedNumberOfCallsInHalfOpenState = 5`
 *   (ADR 표준 3 → quant 은 wave 변동성을 흡수하기 위해 5 로 상향. 동일 패턴 재사용)
 * - `minimumNumberOfCalls = 10` (window 절반)
 *
 * ## 사용 패턴 (resilience4j-kotlin)
 * ```
 * cb.executeSuspendFunction { webClient.post() ... .awaitSingle() }
 * ```
 */
@Configuration
class CircuitBreakerConfiguration {

    @Bean
    fun circuitBreakerRegistry(): CircuitBreakerRegistry {
        val defaultConfig = CircuitBreakerConfig.custom()
            .failureRateThreshold(50f)
            .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(20)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(5)
            .minimumNumberOfCalls(10)
            .build()
        return CircuitBreakerRegistry.of(defaultConfig)
    }

    @Bean(BEAN_BITHUMB_REST_CB)
    fun bithumbRestCircuitBreaker(registry: CircuitBreakerRegistry): CircuitBreaker =
        registry.circuitBreaker(NAME_BITHUMB_REST)

    @Bean(BEAN_BITHUMB_WS_RECONNECT_CB)
    fun bithumbWsReconnectCircuitBreaker(registry: CircuitBreakerRegistry): CircuitBreaker =
        registry.circuitBreaker(NAME_BITHUMB_WS_RECONNECT)

    @Bean(BEAN_TELEGRAM_BOT_CB)
    fun telegramBotCircuitBreaker(registry: CircuitBreakerRegistry): CircuitBreaker =
        registry.circuitBreaker(NAME_TELEGRAM_BOT)

    companion object {
        const val NAME_BITHUMB_REST: String = "bithumb-rest"
        const val NAME_BITHUMB_WS_RECONNECT: String = "bithumb-ws-reconnect"
        const val NAME_TELEGRAM_BOT: String = "telegram-bot"

        const val BEAN_BITHUMB_REST_CB: String = "bithumbRestCircuitBreaker"
        const val BEAN_BITHUMB_WS_RECONNECT_CB: String = "bithumbWsReconnectCircuitBreaker"
        const val BEAN_TELEGRAM_BOT_CB: String = "telegramBotCircuitBreaker"
    }
}
