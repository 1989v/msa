plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":seven-split:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    // TG-04: application port 시그니처가 Coroutine(suspend, Flow) 기반이므로 명시적으로 도입.
    // spring-boot-starter-web 은 Reactor 코루틴을 전이로 끌어오지 않는다.
    implementation(libs.kotlin.coroutines.core)
    // TG-07: 빗썸 REST 호출용 WebClient (WebFlux) + Reactor 코루틴 브릿지 (awaitSingle 등)
    implementation(libs.spring.webflux)
    implementation(libs.kotlin.coroutines.reactor)
    // TG-06.5: ClickHouse JDBC. seven_split DB 접속 / SchemaBootstrapper 에서 사용.
    implementation(libs.clickhouse.jdbc)
    // TG-07.7: kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.kotest.property)
    testImplementation(libs.turbine)
    // TG-06.6: ClickHouse Testcontainers 스키마 스모크 테스트.
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.clickhouse)
    // TG-07.5: 빗썸 REST stub 용 MockWebServer
    testImplementation(libs.mockwebserver)
    testRuntimeOnly(libs.h2)
}

tasks.bootJar {
    archiveBaseName.set("seven-split")
}
