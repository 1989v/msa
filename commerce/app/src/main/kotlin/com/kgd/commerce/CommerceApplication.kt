package com.kgd.commerce

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0058: commerce 모듈러 모놀리스 — inventory+warehouse+fulfillment+order+member+wishlist 도메인 폴드
// (도메인별 datasource/EMF, 스키마 유지). round 2 에서 member/wishlist 추가.
// 웹 게임 아케이드(#23): game 도메인 폴드 — Redis 전용(전용 datasource 없음), Tier B 리플레이 in-JVM.
@SpringBootApplication(scanBasePackages = ["com.kgd.inventory", "com.kgd.warehouse", "com.kgd.fulfillment", "com.kgd.order", "com.kgd.member", "com.kgd.wishlist", "com.kgd.game", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling
class CommerceApplication

fun main(args: Array<String>) {
    runApplication<CommerceApplication>(*args)
}
