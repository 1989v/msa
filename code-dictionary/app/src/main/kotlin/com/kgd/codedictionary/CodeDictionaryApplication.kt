package com.kgd.codedictionary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0059: game:feature 폴드 — com.kgd.game 스캔 추가 (전용 datasource/EMF/TM 은 GameDataSourceConfig 소유)
// ADR-0069: deal:feature 폴드 — com.kgd.deal 스캔 추가 (호스트의 기본 datasource/EMF 공유)
@SpringBootApplication(scanBasePackages = ["com.kgd.codedictionary", "com.kgd.game", "com.kgd.deal", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling // game 주간 트렌딩 리셋 등 경량 스케줄 (ADR-0058: API JVM 코로케이트)
class CodeDictionaryApplication

fun main(args: Array<String>) {
    runApplication<CodeDictionaryApplication>(*args)
}
