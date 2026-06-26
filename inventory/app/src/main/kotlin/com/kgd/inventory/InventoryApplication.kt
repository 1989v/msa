package com.kgd.inventory

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0058: commerce 모듈러 모놀리스 — warehouse 도메인 폴드 (별도 datasource/EMF, 스키마 유지)
@SpringBootApplication(scanBasePackages = ["com.kgd.inventory", "com.kgd.warehouse", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling
class InventoryApplication

fun main(args: Array<String>) {
    runApplication<InventoryApplication>(*args)
}
