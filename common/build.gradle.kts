plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.webflux)
    implementation("org.springframework.boot:spring-boot-webclient")
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.jjwt.api)
    runtimeOnly(libs.jjwt.impl)
    runtimeOnly(libs.jjwt.jackson)
    implementation(libs.spring.cloud.circuitbreaker.resilience4j)
    implementation(libs.kotlin.coroutines.core)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.spring.boot.starter.test)
}

// common은 실행 가능 JAR 아님 — bootJar 비활성화, jar 활성화
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    enabled = false
}

tasks.named<Jar>("jar") {
    enabled = true
}
