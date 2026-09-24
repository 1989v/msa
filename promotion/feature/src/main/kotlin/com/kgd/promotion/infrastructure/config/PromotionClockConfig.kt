package com.kgd.promotion.infrastructure.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.time.Duration

/** 혜택 도메인의 시각 원천과 보류 기한 — 테스트가 고정 시각으로 만료 경계를 돌릴 수 있게 주입한다 */
@Configuration
class PromotionClockConfig {
    @Bean
    fun promotionClock(): Clock = Clock.systemUTC()

    /**
     * 재고·혜택 예약이 같이 쓰는 보류 기한(스펙 SR-4). 사가의 피벗 전 기한 10분 + 결과 미상 재조회 최대 10분보다 길어야 한다.
     */
    @Bean
    fun promotionHoldDuration(@Value("\${commerce.hold-minutes:30}") minutes: Long): Duration {
        require(minutes > 20) { "commerce.hold-minutes 는 사가 기한 합(20분)보다 길어야 한다: $minutes" }
        return Duration.ofMinutes(minutes)
    }
}
