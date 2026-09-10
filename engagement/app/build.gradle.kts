// ADR-0093 — engagement:app: 얇은 deployable aggregator.
// 도메인 로직은 recommendation:feature · experiment:feature 에 있고 여기는
// @SpringBootApplication + 통합 yml 만 든다. 둘을 고른 이유는 ADR-0058 이 계획했던
// 그룹(`engagement`)이고, recommendation 이 JPA datasource 를 갖지 않아
// (ClickHouse read-only + Redis) 데이터소스 충돌이 없기 때문이다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 응답/요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":recommendation:feature"))
    implementation(project(":experiment:feature")) // co-deploy (engagement 모듈러 모놀리스)
    // 메인 클래스(@SpringBootApplication) 컴파일 + bootJar 구성용 최소 의존
    implementation(libs.spring.boot.starter.web)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.data.jpa) // 컨텍스트 로드 검사가 리포지토리 타입 참조
    testImplementation(libs.kotest.extensions.spring)
    // ADR-0058 검증 방법 — 폴드 결함은 실제 컨텍스트를 띄워야 드러난다
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
}

tasks.bootJar {
    archiveBaseName.set("engagement")
}
