plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":analytics:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.spring.kafka)
    implementation(libs.kafka.streams)
    implementation(libs.clickhouse.jdbc)
    implementation(libs.clickhouse.http)
    implementation(libs.hikaricp)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.kafka.streams.test)
}

tasks.bootJar {
    archiveBaseName.set("analytics")
}
