// 웹 게임 아케이드(#23) — game:feature: commerce 모듈러 모놀리스 라이브러리(비-bootable, ADR-0058).
// MVP 는 Redis 전용(세션/리플레이/리더보드 sorted-set/플레이어/데일리) — JPA·전용 datasource 불필요.
// Tier B 는 game:sim(jvm) 의 SimRunner 로 commerce:app JVM 안에서 재실행(추가 프로세스 0).
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":game:domain"))
    implementation(project(":game:sim")) // GameModule/SnakeGame — Tier B + 카탈로그
    implementation(project(":common"))
    implementation(libs.kotlin.logging)
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.testcontainers.junit) // 라이브 E2E — 실제 Redis 컨테이너
}

// 라이브러리 — 실행 가능 JAR 아님(commerce:app 이 조립).
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
