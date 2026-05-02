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
    implementation(libs.spring.kafka)
    // ADR-0029 — IdempotentEventHandler 람다 로깅 (kotlin-logging)
    implementation(libs.kotlin.logging)
    // ADR-0032 Phase 0 — Outbox 모듈에서 @Entity / JpaRepository 를 정의하므로 JPA 의존이 필요하다.
    // 단, JPA 미사용 서비스(gateway 등)에 강제하지 않도록 compileOnly 로만 노출. 사용 서비스
    // (fulfillment, inventory, order 등)는 자체 build.gradle.kts 의 spring-boot-starter-data-jpa
    // 가 런타임 클래스패스를 책임진다.
    compileOnly(libs.spring.boot.starter.data.jpa)
    testImplementation(libs.spring.boot.starter.data.jpa)
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
