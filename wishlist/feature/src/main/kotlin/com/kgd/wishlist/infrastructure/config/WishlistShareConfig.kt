package com.kgd.wishlist.infrastructure.config

import com.kgd.wishlist.application.share.config.WishlistShareProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

/**
 * 묶음 공유 배선 (ADR-0107). 호스트 앱에 `@ConfigurationPropertiesScan` 이 없어 설정 등록을 여기서 한다.
 * 시각 원천은 이름을 한정한다 — 같은 JVM 의 다른 도메인이 Clock 을 내놓아도 겹치지 않게.
 */
@Configuration
@EnableConfigurationProperties(WishlistShareProperties::class)
class WishlistShareConfig {
    @Bean
    fun wishlistClock(): Clock = Clock.systemUTC()
}
