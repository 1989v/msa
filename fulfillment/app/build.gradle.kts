// ADR-0058 — fulfillment:app: 얇은 deployable aggregator (2b — standalone 유지).
// 2c 에서 commerce(inventory:app)로 fold + fulfillment:app 제거 예정.
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":fulfillment:feature"))
    implementation(libs.spring.boot.starter.web)
    // FulfillmentApplication 의 @EntityScan/@EnableJpaRepositories 컴파일용
    implementation(libs.spring.boot.starter.data.jpa)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.kafka.test)
    testImplementation(libs.kotest.extensions.spring)
}

tasks.bootJar {
    archiveBaseName.set("fulfillment")
}
