package com.kgd.common.batch

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Profile
import org.springframework.core.Ordered
import kotlin.system.exitProcess

private val log = KotlinLogging.logger {}

/**
 * 배치 프로파일(`retention` · `linkcheck`)로 띄운 호스트는 러너가 끝나면 프로세스를 내린다.
 *
 * `--spring.main.web-application-type=none` 은 웹서버만 안 띄울 뿐 JVM 을 끝내지 않는다.
 * 스케줄러의 비데몬 스레드가 살아 있어 컨텍스트가 닫히지 않고, 일을 마친 파드가 상주 앱처럼
 * 남아 기동 후 작업까지 돌리다 메모리 한도에서 죽는다. CronJob 은 그것을 실패로 기록하고,
 * `concurrencyPolicy: Forbid` 에서는 안 끝난 Job 하나가 이후 실행을 전부 막는다.
 *
 * 특정 도메인이 아니라 공용 모듈에 두는 이유: 배치는 호스트 앱을 그대로 띄우고, 도메인은
 * 호스트를 옮겨 다닌다. 한 도메인에 두면 그 도메인이 없는 호스트의 배치는 끝나지 않는다.
 *
 * 상주 서비스에서는 떠서는 안 된다 — 뜨면 기동 직후 스스로 내려간다. 그래서 프로파일로만 켠다.
 */
@AutoConfiguration
@Profile("retention | linkcheck")
class BatchExitAutoConfiguration {

    @Bean
    fun batchExitRunner(context: ConfigurableApplicationContext) = BatchExitRunner(context)
}

/** 일하는 러너(`@Order(0)`)가 전부 끝난 뒤에 돌아야 하므로 순서를 맨 뒤로 둔다. */
class BatchExitRunner(
    private val context: ConfigurableApplicationContext,
) : ApplicationRunner, Ordered {

    override fun getOrder(): Int = Ordered.LOWEST_PRECEDENCE

    override fun run(args: ApplicationArguments) {
        val code = SpringApplication.exit(context)
        log.info { "배치 종료 — exit code $code" }
        exitProcess(code)
    }
}
