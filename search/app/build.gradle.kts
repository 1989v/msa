plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":search:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.opensearch.java)
    implementation(libs.httpclient5)
    // opensearch-java JacksonJsonpMapper 의 Kotlin data class 직렬화 (버전: Boot BOM)
    // Jackson 3 (ADR-0067). jsr310 등은 databind 에 내장되어 선언하지 않는다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    // Page/Pageable — 기존엔 spring-data-elasticsearch starter 가 전이 공급 (ADR-0055 로 제거)
    implementation("org.springframework.data:spring-data-commons")
    implementation(libs.spring.boot.starter.data.redis)
    // 내부 API 의 요청 검증 (@Valid) — 배치 상한·빈 목록을 컨트롤러에서 막는다 (ADR-0090)
    implementation(libs.spring.boot.starter.validation)
    // 질의 사전 조회 캐시. 미적중도 담아야 사전에 없는 질의가 매번 OpenSearch 를 치지 않는다 (ADR-0090)
    implementation(libs.caffeine)
    implementation(libs.spring.kafka)
    implementation(libs.spring.cloud.loadbalancer)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    // kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

tasks.bootJar {
    archiveBaseName.set("search")
}
