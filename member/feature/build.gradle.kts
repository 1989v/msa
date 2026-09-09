// ADR-0058 round 2 — member:feature: commerce 모듈러 모놀리스의 라이브러리(비-bootable).
// 다른 도메인 feature 미의존(불변식). 전용 datasource(member_db)는 MemberDataSourceConfig 가 배선.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 응답/요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":member:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    // 탈퇴 시 친구 그룹 파기 호출의 실패를 남긴다 (ADR-0092). 조용히 삼키면 그물(보존 배치)이
    // 있다는 사실만 믿고 실제로 새는 것을 못 본다. 로깅 컨벤션이 kotlin-logging 을 요구한다.
    implementation(libs.kotlin.logging)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

// 라이브러리 — 실행 가능 JAR 아님.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
