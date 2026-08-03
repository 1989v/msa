// ADR-0058 — fulfillment:feature: commerce 모듈러 모놀리스의 라이브러리(비-bootable).
// 다른 도메인 feature 미의존(불변식). 전용 outbox(fulfillment_db 바인딩)는 2c 에서 배선.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":fulfillment:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.spring.kafka)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    implementation(libs.kotlin.logging)
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.kafka.test)
    testImplementation(libs.kotest.extensions.spring)
}

// 라이브러리 — 실행 가능 JAR 아님.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
