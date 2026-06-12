plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":common"))
    implementation(libs.spring.cloud.gateway)
    implementation(libs.spring.cloud.loadbalancer)
    implementation(libs.spring.cloud.circuitbreaker.reactor.resilience4j)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.security)
    implementation(libs.jjwt.api)
    runtimeOnly(libs.jjwt.impl)
    runtimeOnly(libs.jjwt.jackson)
    implementation("io.micrometer:micrometer-registry-prometheus")
    // Swagger UI 집계 — 각 서비스의 /v3/api-docs 를 /api/docs 한 곳에서 탐색
    implementation(libs.springdoc.openapi.starter.webflux.ui)
    // kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.reactor.test)
}
