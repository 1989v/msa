// ADR-0069 — deal:feature: 혜택 링크 허브 라이브러리(비-bootable). code-dictionary:app 이 흡수.
//
// game:feature 와 달리 **전용 datasource 를 만들지 않는다** — 테이블 3개에 독립 쓰기 경로가
// 없고 라이프사이클이 display_service 와 같다. 두 번째 HikariCP 풀은 실제로 강제하지도 않을
// 경계를 위해 free-tier 메모리를 쓰는 일이다. 스키마·마이그레이션은 호스트(code-dictionary)가
// 소유하고, 이 모듈은 코드만 소유한다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":deal:domain"))
    implementation(project(":common"))
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    // Caffeine 직접 사용 — Spring cache 추상화를 쓰지 않는다. 호스트의 CaffeineCacheManager 는
    // 캐시 이름을 고정 목록으로 받는 정적 모드라, @Cacheable 을 쓰려면 호스트 설정을 고쳐야 한다.
    // 폴드된 라이브러리가 호스트 설정에 손대지 않는 편이 재분리도 쉽다.
    implementation(libs.caffeine)
    // kotlin-logging 람다 로깅
    implementation(libs.kotlin.logging)
    // ADR-0093 ② — 전용 스키마(deal_db) 마이그레이션. 폴드 앱에서는 ScopedFlywayMigrator 가
    // 돌리지만 flyway-core 자체는 이 모듈의 의존이다.
    implementation("org.flywaydb:flyway-core")
    runtimeOnly("org.flywaydb:flyway-mysql")
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    // 스키마 검증 — Flyway 적용 + ddl-auto=validate 로 엔티티/마이그레이션 일치를 확인한다.
    // 운영은 ddl-auto=none 이라 불일치가 거기서는 절대 안 드러난다.
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
}

// 라이브러리 — 실행 가능 JAR 아님.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
