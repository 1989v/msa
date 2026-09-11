// ADR-0093 — code-dictionary:feature: atlas 모듈러 모놀리스의 라이브러리(비-bootable).
// 개념 사전·서비스 카탈로그·포트폴리오·전시·이력서. 스키마는 code_dictionary_db 그대로.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
    // JMH micro-benchmark (T5.1) — manual run only: ./gradlew :code-dictionary:app:jmh
    id("me.champeau.jmh") version "0.7.2"
}

dependencies {
    implementation(project(":code-dictionary:domain"))
    // ADR-0093: game:feature 는 content:app 으로 이동
    // ADR-0093 ②: deal:feature 는 commerce:app 으로 이동 (전용 스키마 deal_db)
    // ADR-0093 ③: blog:feature 는 content:app 으로 이동 (전용 스키마 blog_db)
    // ADR-0093 ②b: ranking:feature 는 content:app 으로 이동 (전용 스키마 ranking_db)
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.querydsl.jpa) { artifact { classifier = "jakarta" } }
    kapt(libs.querydsl.apt) { artifact { classifier = "jakarta" } }
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    runtimeOnly(libs.mysql.connector)
    implementation("org.flywaydb:flyway-core")
    runtimeOnly("org.flywaydb:flyway-mysql")
    // Spring Boot 4 split Flyway autoconfig into its own module
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation(libs.opensearch.java)
    implementation(libs.httpclient5)
    // opensearch-java JacksonJsonpMapper 가 Kotlin data class / java.time 을 (역)직렬화할 때 필요
    // Jackson 3 (ADR-0067). jsr310·jdk8·parameter-names 는 databind 에 내장되어 선언하지 않는다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    // Treemap stats endpoint — Caffeine in-memory cache (spec.md §7)
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation(libs.caffeine)
    // kotlin-logging 람다 (logging convention)
    implementation(libs.kotlin.logging)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    // ADR-0059: code-dictionary + game 폴드 컨텍스트 로드 검증 (빈 충돌 / 이중 Flyway)
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
}

// 라이브러리 — 실행 가능 JAR 아님 (ADR-0093: atlas:app 이 링크한다).
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }

// QueryDSL Q class generation path
kotlin.sourceSets.main { kotlin.srcDir("build/generated/source/kapt/main") }

// JMH source set (src/jmh/kotlin) — uses production classpath; manual execution only.
// 기본 plugin 설정만 사용 (warm-up / measurement / fork 는 어노테이션 레벨에서 정의).
jmh {
    // benchmarkMode / warmupIterations / iterations 는 GetCategoryStatsBench 클래스 어노테이션 사용.
    // 결과 디렉토리: build/results/jmh
    resultFormat.set("JSON")
}
