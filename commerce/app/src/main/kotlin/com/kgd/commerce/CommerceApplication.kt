package com.kgd.commerce

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0058: commerce 모듈러 모놀리스 — inventory+warehouse+fulfillment+order 도메인 폴드
// (도메인별 datasource/EMF, 스키마 유지).
// ADR-0093: member·wishlist 는 account 호스트로 옮겼다 — 커머스 트랜잭션이 아니라 사람에 관한 데이터다.
@SpringBootApplication(scanBasePackages = ["com.kgd.inventory", "com.kgd.warehouse", "com.kgd.fulfillment", "com.kgd.order", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling
class CommerceApplication

fun main(args: Array<String>) {
    runApplication<CommerceApplication>(*args)
}
