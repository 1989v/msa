package com.kgd.commerce.seller

import com.kgd.seller.infrastructure.crypto.AesGcmAccountCipher
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.core.env.StandardEnvironment
import org.springframework.core.io.ClassPathResource
import org.springframework.core.env.ConfigurableEnvironment

/**
 * `SELLER_ACCOUNT_ENC_KEY` 가 없으면 commerce 가 기동하지 않는다.
 *
 * 판정 근거는 **실제 commerce `application.yml`** 과 **실제 암호화 빈**이다 — 설정 파일에 기본값이
 * 끼어들면(`${SELLER_ACCOUNT_ENC_KEY:…}`) 이 검사가 빨간불이 된다. 개발 PC 의 환경변수가 섞이지
 * 않도록 시스템 환경 소스를 걷고 Boot 와 같은 엄격한 플레이스홀더 해석기를 쓴다.
 */
class SellerAccountKeyStartupSpec : BehaviorSpec({

    fun runner(vararg env: Pair<String, String>) = ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration::class.java))
        .withInitializer { ctx ->
            val environment: ConfigurableEnvironment = ctx.environment
            environment.propertySources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME)
            YamlPropertySourceLoader().load("commerce-application", ClassPathResource("application.yml"))
                .forEach(environment.propertySources::addLast)
        }
        .withPropertyValues(*env.map { (k, v) -> "$k=$v" }.toTypedArray())
        .withBean(AesGcmAccountCipher::class.java)

    given("commerce application.yml") {
        then("SELLER_ACCOUNT_ENC_KEY 가 없으면 컨텍스트가 뜨지 않는다") {
            runner().run { ctx ->
                val failure = ctx.startupFailure.shouldNotBeNull()
                generateSequence(failure as Throwable) { it.cause }.joinToString(" | ") { it.message.orEmpty() } shouldContain
                    "SELLER_ACCOUNT_ENC_KEY"
            }
        }
        then("키 형식이 틀려도 뜨지 않는다") {
            runner("SELLER_ACCOUNT_ENC_KEY" to "not-a-key").run { ctx ->
                ctx.startupFailure.shouldNotBeNull()
            }
        }
        then("32바이트 hex 키가 있으면 뜬다") {
            runner("SELLER_ACCOUNT_ENC_KEY" to "ab".repeat(32)).run { ctx ->
                ctx.startupFailure shouldBe null
                ctx.getBean(AesGcmAccountCipher::class.java).shouldNotBeNull()
            }
        }
    }
})
