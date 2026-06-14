package com.kgd.search

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0055 — OsBulkDocumentProcessor 의 주기 flush (@Scheduled) 활성화
@EnableScheduling
@SpringBootApplication
class SearchConsumerApplication

fun main(args: Array<String>) {
    runApplication<SearchConsumerApplication>(*args)
}
