package com.kgd.settlement.infrastructure.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

/** 정산 도메인의 시각 원천 — 정산 기간(KST) 판정을 테스트에서 원하는 날로 돌리기 위해 주입한다 */
@Configuration
class SettlementClockConfig {
    @Bean
    fun settlementClock(): Clock = Clock.systemUTC()
}
