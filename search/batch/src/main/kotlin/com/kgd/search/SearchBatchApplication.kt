package com.kgd.search

import com.kgd.search.infrastructure.eval.EvalProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0055 — OsBulkDocumentProcessor 의 주기 flush (@Scheduled) 활성화
@EnableScheduling
@SpringBootApplication
@EnableConfigurationProperties(EvalProperties::class)
class SearchBatchApplication

fun main(args: Array<String>) {
    runApplication<SearchBatchApplication>(*args)
}
