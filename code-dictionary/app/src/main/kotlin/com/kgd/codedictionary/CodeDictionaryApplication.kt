package com.kgd.codedictionary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

// ADR-0059: game:feature 폴드 — com.kgd.game 스캔 추가 (전용 datasource/EMF/TM 은 GameDataSourceConfig 소유)
@SpringBootApplication(scanBasePackages = ["com.kgd.codedictionary", "com.kgd.game", "com.kgd.common.exception", "com.kgd.common.response"])
class CodeDictionaryApplication

fun main(args: Array<String>) {
    runApplication<CodeDictionaryApplication>(*args)
}
