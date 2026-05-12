plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
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
