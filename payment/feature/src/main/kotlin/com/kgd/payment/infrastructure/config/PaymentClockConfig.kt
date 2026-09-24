package com.kgd.payment.infrastructure.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

/** 결제 도메인의 시각 원천 — 재조회 백오프·대사 정산일을 테스트에서 고정 시각으로 돌리기 위해 주입한다 */
@Configuration
class PaymentClockConfig {
    @Bean
    fun paymentClock(): Clock = Clock.systemUTC()
}
