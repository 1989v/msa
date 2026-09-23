package com.kgd.ads.infrastructure.config

import com.kgd.ads.application.token.config.AdsTokenProperties
import com.kgd.ads.domain.token.model.SigningKey
import com.kgd.ads.domain.token.policy.ServeTokenSigner
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.time.ZoneId
import kotlin.random.Random

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AdsTokenProperties::class)
class AdsConfig {

    /**
     * ads 가 시간을 읽는 유일한 곳. 「하루」·「시각」이 KST 달력 기준이라 KST 로 둔다.
     * 호스트의 다른 도메인이 `Clock` 을 주입받을 때 섞이지 않게 이름으로만 주입한다.
     */
    @Bean
    fun adsClock(): Clock = Clock.system(KST)

    /** 페이싱 난수. 테스트가 같은 이름의 빈으로 바꿔 통과 여부를 고정한다. */
    @Bean
    fun adsRandom(): Random = Random.Default

    @Bean
    fun serveTokenSigner(
        properties: AdsTokenProperties,
        @Qualifier("adsClock") clock: Clock,
    ): ServeTokenSigner = ServeTokenSigner(
        current = SigningKey.of(properties.currentKey),
        previous = properties.previousKey?.let(SigningKey::of),
        clock = clock,
    )

    companion object {
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
