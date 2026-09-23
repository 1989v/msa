// ADR-0098 — ads:feature: engagement 모듈러 모놀리스의 라이브러리(비-bootable).
// 전용 스키마 ads_db(비-primary datasource)와 전용 Redis 연결을 스스로 배선한다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 기본값이 무시되고 non-null 에 null 이 들어간다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":ads:domain"))
    implementation(project(":common"))
    implementation(libs.kotlin.logging)
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    // ScopedFlywayMigrator(adsdb/migration) — 폴드된 앱이라 Boot 자동설정 대신 직접 배선
    implementation("org.flywaydb:flyway-core")
    runtimeOnly("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

// 라이브러리 — 실행 가능 JAR 아님 (engagement:app 이 링크한다).
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
