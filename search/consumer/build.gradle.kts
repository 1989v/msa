plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":search:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.opensearch.java)
    implementation(libs.httpclient5)
    // ADR-0055 — opensearch-java JacksonJsonpMapper 의 Kotlin data class / java.time 직렬화
    // Jackson 3 (ADR-0067). jsr310 등은 databind 에 내장되어 선언하지 않는다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    // opensearch-java 의 JacksonJsonpMapper 가 Jackson 2 로 빌드돼 있어 그 경계에서만 필요하다.
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
    implementation(libs.spring.kafka)
    // kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

tasks.bootJar {
    archiveBaseName.set("search-consumer")
}
