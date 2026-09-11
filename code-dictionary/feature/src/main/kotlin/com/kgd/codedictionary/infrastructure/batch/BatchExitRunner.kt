package com.kgd.codedictionary.infrastructure.batch

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.SpringApplication
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.context.annotation.Profile
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import kotlin.system.exitProcess

private val log = KotlinLogging.logger {}

/**
 * 배치 프로파일에서 일이 끝나면 프로세스를 내린다.
 *
 * `--spring.main.web-application-type=none` 은 웹서버만 안 띄울 뿐 JVM 을 끝내지 않는다.
 * 스케줄러의 비데몬 스레드가 살아 있어 컨텍스트가 닫히지 않고, 작업을 마친 파드가 그대로
 * 남는다. CronJob 은 `concurrencyPolicy: Forbid` 라 그 Job 하나가 **이후 모든 실행을 막는다**
 * (2026-08-23 이후 retention·deal-linkcheck 이 열흘간 한 번도 다시 돌지 못했다).
 *
 * 일하는 러너보다 뒤에 돌아야 하므로 순서를 명시한다 — @Order 가 없으면 전부 같은 우선순위라
 * 실행 순서가 정해지지 않는다.
 */
@Component
@Profile("retention | linkcheck")
@Order(Ordered.LOWEST_PRECEDENCE)
class BatchExitRunner(
    private val context: ConfigurableApplicationContext,
) : ApplicationRunner {

    override fun run(args: ApplicationArguments) {
        val code = SpringApplication.exit(context)
        log.info { "배치 종료 — exit code $code" }
        exitProcess(code)
    }
}
