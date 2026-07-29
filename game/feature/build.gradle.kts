// ADR-0059 — game:feature: 게임 플랫폼 라이브러리(비-bootable). code-dictionary:app 이 흡수.
// 전용 datasource(game_db)/EMF/TM/Flyway 는 GameDataSourceConfig 가 소유.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":game:domain"))
    implementation(project(":game:sim")) // #23 흡수: GameModule/SnakeGame — Tier B 검증
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.data.redis) // #23 흡수: 리더보드 ZSET/세션
    implementation(libs.querydsl.jpa) { artifact { classifier = "jakarta" } }
    kapt(libs.querydsl.apt) { artifact { classifier = "jakarta" } }
    implementation(libs.spring.kafka)
    implementation(libs.kotlin.logging)
    implementation("org.flywaydb:flyway-core")
    runtimeOnly("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.mockk)
    // ADR-0059: 실제 MySQL 로 Flyway 마이그레이션 + 엔티티 매핑(validate) + Querydsl SQL 검증
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }

// QueryDSL Q class generation path
kotlin.sourceSets.main { kotlin.srcDir("build/generated/source/kapt/main") }
