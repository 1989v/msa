// ADR-0072 — blog:feature: 블로그 플랫폼 라이브러리(비-bootable). code-dictionary:app 이 흡수.
//
// deal 과 같이 **전용 datasource 를 만들지 않는다** — 스키마·마이그레이션은 호스트가 소유하고
// 이 모듈은 코드만 소유한다. 재분리 시 이 파일과 호스트의 의존 한 줄만 되돌리면 된다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":blog:domain"))
    implementation(project(":common"))
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    // 글 상세의 크롤러용 본문을 서버에서 만든다 (ADR-0072 §6). raw HTML 은 이스케이프하므로
    // 별도 sanitizer 가 필요 없다.
    implementation(libs.commonmark)
    // 셸 HTML 캐시 — deal 과 같은 이유로 Spring cache 추상화를 쓰지 않고 직접 쓴다.
    implementation(libs.caffeine)
    implementation(libs.kotlin.logging)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

// 라이브러리 — 실행 가능 JAR 아님.
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") { enabled = false }
tasks.named<Jar>("jar") { enabled = true }
