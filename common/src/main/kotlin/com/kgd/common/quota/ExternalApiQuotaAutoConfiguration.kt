package com.kgd.common.quota

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.core.StringRedisTemplate

/**
 * 외부 API 쿼터 장부 배선 (ADR-0082).
 *
 * **`@ConditionalOnProperty` 로 감추지 않는다.** 프로퍼티를 안 켠 서비스는 빈 주입을 못 받고,
 * 그러면 게이트를 안 타는 게 정상 경로가 된다 — 강제가 선택으로 바뀐다.
 * Redis 가 있으면 제공자 단위 합산, 없으면 파드 단위 폴백으로 **항상 하나는 존재**한다.
 *
 * `StringRedisTemplate` 을 쓰는 이유: standalone·cluster 양쪽에서 Boot 가 만들어 준다.
 * [com.kgd.common.redis.CommonRedisAutoConfiguration] 은 cluster 전용이라 k3s-lite 에서 안 뜬다.
 *
 * `afterName` 이 빠지면 `@ConditionalOnBean` 이 Redis 자동 설정보다 먼저 평가돼 템플릿이 아직 없다고 보고
 * 모든 파드가 메모리 장부로 떨어진다(2026-10-20 운영 전 파드에서 확인). 그러면 Python 잡이 Redis 에 센
 * 사용량을 JVM 이 못 보고 매일 한도가 통째로 남은 것처럼 판단한다. 이름으로 거는 이유는 redis 가 이 모듈의
 * `implementation` 의존이라 쓰는 쪽 클래스패스에 자동 설정 클래스가 없을 수도 있어서다.
 */
@AutoConfiguration(afterName = ["org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration"])
class ExternalApiQuotaAutoConfiguration {

    /** Redis 가 있는 정상 경로 — 서비스·언어를 가로질러 합산된다. */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnBean(StringRedisTemplate::class)
    class RedisBacked {
        @Bean
        @ConditionalOnMissingBean(ExternalApiQuotaLedger::class)
        fun externalApiQuotaLedger(redis: StringRedisTemplate): ExternalApiQuotaLedger =
            RedisExternalApiQuotaLedger(redis)
    }

    /** Redis 가 없을 때의 폴백 — 파드 단위로만 센다(기동 시 경고). */
    @Bean
    @ConditionalOnMissingBean(ExternalApiQuotaLedger::class)
    fun inMemoryExternalApiQuotaLedger(): ExternalApiQuotaLedger = InMemoryExternalApiQuotaLedger()
}
