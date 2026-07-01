// ADR-0058 round 2 — wishlist:feature: commerce 모듈러 모놀리스의 라이브러리(비-bootable).
// Kafka consumer(product.deleted/member.withdrawn) 보유 → 전용 prefix Kafka factory(WishlistKafkaConfig).
// 전용 datasource(wishlist_db)는 WishlistDataSourceConfig 가 배선.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":wishlist:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.spring.kafka)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    // kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.kafka.test)
    testImplementation(libs.kotest.extensions.spring)
}

// 라이브러리 — 실행 가능 JAR 아님.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
