package com.kgd.common.batch

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.core.Ordered

/**
 * 프로세스를 내리는 러너는 배치 프로파일에서만 실린다.
 * 판정 근거: 자동 설정을 실제 등록 경로(AutoConfigurations)로 올렸을 때 컨텍스트에 실린 러너 빈.
 * 러너의 `run` 은 부르지 않는다 — 부르면 테스트 JVM 이 내려간다.
 */
class BatchExitAutoConfigurationSpec : BehaviorSpec({

    fun runner() = ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(BatchExitAutoConfiguration::class.java))

    given("상주 서비스 — 배치 프로파일이 없다") {
        `when`("컨텍스트가 뜨면") {
            then("종료 러너가 없다 — 있으면 서비스가 기동 직후 스스로 내려간다") {
                runner().withPropertyValues("spring.profiles.active=kubernetes")
                    .run { ctx -> ctx.getBeansOfType(BatchExitRunner::class.java).values.shouldBeEmpty() }
            }
        }
    }

    listOf("retention", "linkcheck").forEach { profile ->
        given("배치 프로파일 $profile 로 띄운 호스트") {
            `when`("컨텍스트가 뜨면") {
                then("종료 러너가 하나 실리고 일하는 러너보다 뒤에 돈다") {
                    runner().withPropertyValues("spring.profiles.active=kubernetes,$profile")
                        .run { ctx ->
                            val runners = ctx.getBeansOfType(BatchExitRunner::class.java).values
                            runners.shouldHaveSize(1)
                            runners.single().order shouldBe Ordered.LOWEST_PRECEDENCE
                        }
                }
            }
        }
    }
})
