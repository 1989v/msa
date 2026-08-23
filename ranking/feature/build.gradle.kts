// ADR-0081 — ranking:feature: 랭킹 리더보드 라이브러리(비-bootable). code-dictionary:app 이 흡수.
//
// deal:feature 와 같은 형태로 **전용 datasource 를 만들지 않는다** — 스키마·마이그레이션은
// 호스트(code-dictionary)가 소유하고 이 모듈은 코드만 소유한다. 두 번째 HikariCP 풀은
// 실제로 강제하지도 않을 경계를 위해 free-tier 메모리를 쓰는 일이다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":ranking:domain"))
    implementation(project(":common"))
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    // 길찾기 응답 캐시 — Spring cache 추상화를 쓰지 않는다. 호스트의 CaffeineCacheManager 는
    // 캐시 이름을 고정 목록으로 받는 정적 모드라 @Cacheable 을 쓰려면 호스트 설정을 고쳐야 한다
    // (deal:feature 와 같은 판단 — 폴드된 라이브러리가 호스트 설정에 손대지 않는 편이 재분리도 쉽다).
    implementation(libs.caffeine)
    implementation(libs.kotlin.logging)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

// 라이브러리 — 실행 가능 JAR 아님.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
