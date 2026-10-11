package com.kgd.wishlist.infrastructure.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

/**
 * 묶음 공유 배선 (ADR-0107). 시각 원천은 이름을 한정한다 — 같은 JVM 의 다른 도메인이 Clock 을 내놓아도 겹치지 않게.
 */
@Configuration
class WishlistShareConfig {
    @Bean
    fun wishlistClock(): Clock = Clock.systemUTC()
}
