plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 응답/요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":recommendation:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.spring.kafka)
    implementation(libs.kotlin.logging)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    implementation("org.apache.commons:commons-math3:3.6.1")  // BetaDistribution for ThompsonSampler

    // ClickHouse JDBC — analytics DB 조회용 (read-only).
    implementation("com.clickhouse:clickhouse-jdbc:0.6.0")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.mockk)
}

tasks.bootJar {
    archiveBaseName.set("recommendation")
}
