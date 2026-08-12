plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":place:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    implementation(libs.kotlin.logging)
    // OpenSearch — POI geo_distance 근처검색 (ADR-0056 Part 2, Phase 3)
    implementation(libs.opensearch.java)
    implementation(libs.httpclient5)
    implementation("tools.jackson.module:jackson-module-kotlin")
    // Flyway+validate — 스키마 변경은 Flyway 단독 책임 (jpa-persistence.md)
    // Boot 4 는 Flyway 자동설정을 이 모듈로 분리했다 — 없으면 마이그레이션이 조용히 건너뛰어진다
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.mockk)
}

tasks.bootJar {
    archiveBaseName.set("place")
}
