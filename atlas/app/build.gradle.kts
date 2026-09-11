// ADR-0093 — atlas:app: 얇은 deployable aggregator.
// 도메인 로직은 :code-dictionary:feature 에 있고, 여기는 @SpringBootApplication + 통합 yml 만.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":code-dictionary:feature"))
    // 메인 클래스(@SpringBootApplication) 컴파일 + bootJar 구성용 최소 의존
    implementation(libs.spring.boot.starter.web)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.data.jpa)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.mysql)
}

tasks.bootJar {
    archiveBaseName.set("atlas")
}
