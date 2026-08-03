// ADR-0058 — order:feature: commerce 모듈러 모놀리스 라이브러리(비-bootable). 전용 outbox/idempotency 는 OrderDataSourceConfig/OrderMessagingConfig.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":order:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.spring.kafka)
    implementation(libs.spring.webflux) // WebClient only
    implementation(libs.kotlin.coroutines.core)
    implementation(libs.kotlin.coroutines.reactor)
    implementation(libs.resilience4j.circuitbreaker)
    implementation(libs.resilience4j.kotlin)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    implementation(libs.kotlin.logging)
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)

    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.mockk)
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
