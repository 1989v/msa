plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":search:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.boot.starter.data.elasticsearch)
    implementation(libs.spring.boot.starter.batch)
    // Spring Boot 4.0: starter-batch 만으로는 DataSource/TransactionManager auto-config 가
    // 활성화되지 않아 명시적으로 starter-jdbc 를 추가한다 (BatchTransactionManagerConfig 의
    // 임시 빈 등록을 대체). spring-jdbc + HikariCP + DataSourceAutoConfiguration 일괄.
    implementation(libs.spring.boot.starter.jdbc)
    implementation(libs.spring.webflux)
    implementation(libs.kotlin.coroutines.reactor)
    implementation(libs.hikaricp)
    runtimeOnly(libs.h2)
    runtimeOnly(libs.mysql.connector)
    // ADR-0050 Phase 4 — eval 잡이 ClickHouse 의 judgments / eval_results 사용
    implementation(libs.clickhouse.jdbc)
    // kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.mockk)
    testImplementation(libs.spring.batch.test)
}

tasks.bootJar {
    archiveBaseName.set("search-batch")
}
