package com.kgd.commerce

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0058: commerce 모듈러 모놀리스 — inventory+warehouse+fulfillment+order 도메인 폴드
// (도메인별 datasource/EMF, 스키마 유지).
// ADR-0093: member·wishlist 는 account 호스트로 옮겼고, product(카탈로그 SSOT)가 들어왔다 —
// 사가 참여자인데 혼자 밖에 있던 것을 안으로 들였다.
// ADR-0093 ②: deal(혜택 링크 허브)도 커머스 성격이라 여기로. 전용 스키마 deal_db 를 갖는다.
@SpringBootApplication(scanBasePackages = ["com.kgd.inventory", "com.kgd.warehouse", "com.kgd.fulfillment", "com.kgd.order", "com.kgd.product", "com.kgd.deal", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling
class CommerceApplication

fun main(args: Array<String>) {
    runApplication<CommerceApplication>(*args)
}
