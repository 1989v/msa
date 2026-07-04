package com.kgd.search

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.kafka.annotation.EnableKafka
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0055 — OsBulkDocumentProcessor 의 주기 flush (@Scheduled) 활성화
// Spring Boot 4.x — @KafkaListener 자동 등록이 보장되지 않아 @EnableKafka 명시 (로컬 검증에서 미구독 확인)
@EnableKafka
@EnableScheduling
@SpringBootApplication
class SearchConsumerApplication

fun main(args: Array<String>) {
    runApplication<SearchConsumerApplication>(*args)
}
