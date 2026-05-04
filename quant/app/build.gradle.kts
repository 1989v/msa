plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":quant:domain"))
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
    // TG-06.5: ClickHouse JDBC. quant DB 접속 / SchemaBootstrapper 에서 사용.
    implementation(libs.clickhouse.jdbc)
    // TG-07.7: kotlin-logging 람다 로깅 (ADR-0021)
    implementation(libs.kotlin.logging)
    // TG-08: Flyway MySQL 마이그레이션 (V001__init.sql)
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)
    // ADR-0033/0035 Phase 1 후반 — pgvector 어댑터용 PostgreSQL 드라이버 (secondary DS)
    runtimeOnly("org.postgresql:postgresql:42.7.4")
    // Phase 2 — TG-P2-01: 신규 카탈로그 등재
    implementation(libs.resilience4j.circuitbreaker)
    implementation(libs.resilience4j.kotlin)
    implementation(libs.resilience4j.ratelimiter)
    implementation(libs.oci.kms)        // ADR-0027 KEK envelope encryption
    implementation(libs.oci.common)
    implementation(libs.nimbus.jose)    // 빗썸/업비트 JWT(HS256) 인증 (ADR-0024 Errata)
    // Phase 2 — TG-P2-03: KMS DEK 캐시 (TTL 30분 + stale-on-error)
    implementation(libs.caffeine)
    // Phase 2 — TG-P2-06: 빗썸 WebSocket 클라이언트 (reactor-netty)
    implementation("io.projectreactor.netty:reactor-netty-http")
    // Phase 2 — TG-P2-07: Kafka fan-out collector + TG-P2-12 Outbox relay
    implementation(libs.spring.kafka)
    // Phase 2 — TG-P2-11: Redis Lua token bucket Rate Limiter (StringRedisTemplate)
    implementation(libs.spring.boot.starter.data.redis)
    // Phase 2 Rate Limiter: Redis Lua script 직접 구현. Bucket4j는 Phase 3 검토 시 도입.
    // Quant 통합 플랫폼 (ADR-0033/0034) — 기술적 지표 + 임베딩 numeric array
    implementation(libs.ta4j.core)
    implementation(libs.multik.core)
    implementation(libs.multik.default)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.kotest.property)
    testImplementation(libs.turbine)
    // TG-06.6: ClickHouse Testcontainers 스키마 스모크 테스트.
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.clickhouse)
    // TG-08.7: MySQL Testcontainers 통합 테스트 (Persistence adapter + Flyway)
    testImplementation(libs.testcontainers.mysql)
    // TG-07.5: 빗썸 REST stub 용 MockWebServer
    testImplementation(libs.mockwebserver)
    testRuntimeOnly(libs.h2)
}

tasks.bootJar {
    archiveBaseName.set("quant")
}

// Integration specs 는 Docker 필요. 기본 test 에서 제외하고, 명시적으로 `-PincludeIntegration=true`
// 또는 `--tests '*IntegrationSpec*'` 호출 시에만 실행.
tasks.test {
    if (!project.hasProperty("includeIntegration")) {
        filter {
            isFailOnNoMatchingTests = false
            excludeTestsMatching("*IntegrationSpec")
        }
    }
}
