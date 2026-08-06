package com.kgd.search

import com.kgd.search.infrastructure.eval.EvalProperties
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling
import kotlin.system.exitProcess

// ADR-0055 — OsBulkDocumentProcessor 의 주기 flush (@Scheduled) 활성화
@EnableScheduling
@SpringBootApplication
@EnableConfigurationProperties(EvalProperties::class)
class SearchBatchApplication

fun main(args: Array<String>) {
    val context = runApplication<SearchBatchApplication>(*args)
    // 배치 실행 모드(K8s Job/CronJob)에서는 잡 종료 후에도 웹서버(actuator)가 JVM 을
    // 붙잡아 Job 이 Complete 되지 않으므로 명시적으로 종료한다. exit code 는
    // JobExecutionExitCodeGenerator 가 잡 결과를 반영 (실패 시 non-zero → K8s 재시도).
    if (context.environment.getProperty("spring.batch.job.enabled", Boolean::class.java, false)) {
        exitProcess(SpringApplication.exit(context))
    }
}
