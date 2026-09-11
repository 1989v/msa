// ADR-0093 — place:feature: content 모듈러 모놀리스의 라이브러리(비-bootable).
// 행정 지리 계층 + POI + 관광지 SSOT. 전용 datasource(place_db)+Flyway 는 PlaceDataSourceConfig 가 배선한다.
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
    // 스키마 검증 — Flyway 적용 + ddl-auto=validate 로 엔티티/마이그레이션 일치를 확인한다.
    // 운영은 ddl-auto=none 이라 불일치가 거기서는 절대 안 드러난다.
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
    testImplementation(libs.mockk)
}

// 라이브러리 — 실행 가능 JAR 아님 (ADR-0093: content:app 이 링크한다).
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
