package com.kgd.order.infrastructure.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

/** 주문서 만료 등 order 의 시각 — 테스트가 고정 시계로 바꿔 끼운다. 폴드 호스트에 시계가 여럿이라 이름을 붙인다 */
@Configuration
class OrderClockConfig {
    @Bean
    fun orderClock(): Clock = Clock.systemUTC()
}
