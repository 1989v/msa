package com.kgd.ads.support

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.SpringBootConfiguration
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.Primary
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.random.Random

/**
 * ads 만 올리는 통합 테스트 컨텍스트 — 호스트(engagement)의 recommendation·experiment·Kafka 없이.
 * 호스트 폴드 배선은 `EngagementContextLoadSpec` 이 따로 본다.
 *
 * 시계와 페이싱 난수는 운영 빈과 같은 한정자(`adsClock`·`adsRandom`)를 달고 `@Primary` 로 이긴다.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(basePackages = ["com.kgd.ads", "com.kgd.common.exception", "com.kgd.common.response"])
class AdsIntegrationTestApplication {

    @Bean
    @Primary
    @Qualifier("adsClock")
    fun testAdsClock(): MutableClock = MutableClock(NOON_HALF.atZone(KST).toInstant(), KST)

    /** 페이싱을 항상 통과시킨다 — 차단 경로 테스트가 난수에 흔들리지 않게. */
    @Bean
    @Primary
    @Qualifier("adsRandom")
    fun testAdsRandom(): Random = object : Random() {
        override fun nextBits(bitCount: Int): Int = 0
        override fun nextDouble(): Double = 0.0
    }

    companion object {
        val KST: ZoneId = ZoneId.of("Asia/Seoul")

        /** 테스트 기본 시각 — 2026-09-23 12:30 KST. */
        val NOON_HALF: LocalDateTime = LocalDateTime.of(2026, 9, 23, 12, 30)
    }
}

class MutableClock(private var now: Instant, private val zone: ZoneId) : Clock() {
    override fun getZone(): ZoneId = zone
    override fun withZone(zone: ZoneId): Clock = MutableClock(now, zone)
    override fun instant(): Instant = now

    fun set(at: LocalDateTime) {
        now = at.atZone(zone).toInstant()
    }
}
