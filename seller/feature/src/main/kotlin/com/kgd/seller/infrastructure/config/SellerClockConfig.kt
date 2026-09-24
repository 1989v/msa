package com.kgd.seller.infrastructure.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

/** 판매자 도메인의 시각 원천 — 반려 30일 파기 같은 기한 판정을 테스트에서 고정 시각으로 돌리기 위해 주입한다. */
@Configuration
class SellerClockConfig {
    @Bean
    fun sellerClock(): Clock = Clock.systemUTC()
}
