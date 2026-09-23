package com.kgd.ads.infrastructure.config

import com.kgd.ads.application.token.config.AdsTokenProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.time.ZoneId

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AdsTokenProperties::class)
class AdsConfig {

    /**
     * ads 가 시간을 읽는 유일한 곳. 「하루」·「시각」이 KST 달력 기준이라 KST 로 둔다.
     * 호스트의 다른 도메인이 `Clock` 을 주입받을 때 섞이지 않게 이름으로만 주입한다.
     */
    @Bean
    fun adsClock(): Clock = Clock.system(KST)

    companion object {
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
