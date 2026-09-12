// ADR-0093 — account:app: 얇은 deployable aggregator.
// 사람에 관한 데이터(member·wishlist)를 담는다. 도메인 로직은 각 feature 에 있고
// 여기는 @SpringBootApplication + 통합 yml 만. 재분리 시 이 파일만 지우면 된다.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067)
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":member:feature"))
    implementation(project(":wishlist:feature")) // co-deploy (account 모듈러 모놀리스)
    implementation(libs.spring.boot.starter.web)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.data.jpa)
    // 쓰기 경로 스모크가 wishlist 도메인 타입과 Kafka 레코드를 만든다
    testImplementation(project(":wishlist:domain"))
    testImplementation(libs.spring.kafka)
    testImplementation(libs.kotest.extensions.spring)
    // ADR-0058 검증 방법 — 폴드 결함은 실제 컨텍스트를 띄워야 드러난다
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
}

tasks.bootJar {
    archiveBaseName.set("account")
}
