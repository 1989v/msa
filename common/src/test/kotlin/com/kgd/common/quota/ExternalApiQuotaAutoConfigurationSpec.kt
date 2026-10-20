package com.kgd.common.quota

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.types.shouldBeInstanceOf
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner

/**
 * 장부 구현은 Redis 자동 설정이 만든 템플릿을 보고 고른다.
 * 판정 근거: 두 자동 설정을 실제 정렬 규칙(AutoConfigurations)으로 함께 올렸을 때 컨텍스트에 실린 장부의 타입.
 */
class ExternalApiQuotaAutoConfigurationSpec : BehaviorSpec({

    given("Redis 자동 설정이 함께 있는 서비스") {
        `when`("컨텍스트가 뜨면") {
            then("Redis 장부를 쓴다 — 메모리 장부로 떨어지면 다른 파드·Python 잡이 쓴 양을 못 본다") {
                ApplicationContextRunner()
                    .withConfiguration(
                        AutoConfigurations.of(
                            ExternalApiQuotaAutoConfiguration::class.java,
                            DataRedisAutoConfiguration::class.java,
                        ),
                    )
                    .run { ctx -> ctx.getBean(ExternalApiQuotaLedger::class.java).shouldBeInstanceOf<RedisExternalApiQuotaLedger>() }
            }
        }
    }

    given("Redis 가 없는 서비스") {
        `when`("컨텍스트가 뜨면") {
            then("메모리 장부로 폴백한다") {
                ApplicationContextRunner()
                    .withConfiguration(AutoConfigurations.of(ExternalApiQuotaAutoConfiguration::class.java))
                    .run { ctx -> ctx.getBean(ExternalApiQuotaLedger::class.java).shouldBeInstanceOf<InMemoryExternalApiQuotaLedger>() }
            }
        }
    }
})
