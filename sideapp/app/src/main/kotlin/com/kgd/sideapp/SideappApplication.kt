package com.kgd.sideapp

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0093: sideapp 모듈러 모놀리스 — quant+chatbot+gifticon 폴드.
// 셋 다 커머스/노출 어느 축에도 안 붙는 "도메인 단절 사이드앱"이라 한 JVM 에 모았다
// (ADR-0058 이 code-dictionary 에 붙였던 성격 분류를 실제로 실행한 것).
// 도메인별 datasource/EMF/TM 은 각 feature 의 *DataSourceConfig 가 배선한다.
@SpringBootApplication(
    scanBasePackages = [
        "com.kgd.quant",
        "com.kgd.chatbot",
        "com.kgd.gifticon",
        "com.kgd.common.exception",
        "com.kgd.common.response",
    ],
)
// quant 의 @ConfigurationProperties 는 스캔으로만 등록된다 — 독립 앱의 QuantApplication 에 있던
// 선언을 그대로 옮긴다. 빠지면 quant.clickhouse/charts/kms 바인딩이 통째로 사라진다.
@ConfigurationPropertiesScan(basePackages = ["com.kgd.quant"])
// quant OutboxRelay / gifticon 만료 알림 둘 다 @Scheduled 다.
@EnableScheduling
class SideappApplication

fun main(args: Array<String>) {
    runApplication<SideappApplication>(*args)
}
