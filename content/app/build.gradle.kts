// ADR-0093 — content:app: 얇은 deployable aggregator.
// 도메인 로직은 feature 라이브러리에 있고, 여기는 @SpringBootApplication + 통합 yml 만.
// ②~③단계에서 blog·ranking 이 (스키마 분리 후) 여기로 합류한다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 응답/요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":place:feature"))
    implementation(project(":game:feature")) // co-deploy (content 모듈러 모놀리스)
    implementation(project(":ranking:feature")) // ADR-0093 ②b: 랭킹 리더보드 폴드 (전용 스키마 ranking_db)
    implementation(project(":blog:feature")) // ADR-0093 ③: 블로그 플랫폼 폴드 (전용 스키마 blog_db)
    // 메인 클래스(@SpringBootApplication) 컴파일 + bootJar 구성용 최소 의존
    implementation(libs.spring.boot.starter.web)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.data.jpa) // dual-DS 테스트가 DataSource 타입 참조
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.testcontainers.junit) // ADR-0093: dual-datasource context-load 검증
    testImplementation(libs.testcontainers.mysql)
}

tasks.bootJar {
    archiveBaseName.set("content")
}
