plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 응답/요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
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
