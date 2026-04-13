plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":inventory:domain"))
    implementation(project(":common"))
    implementation(libs.kotlin.logging)
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.spring.kafka)
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    runtimeOnly(libs.mysql.connector)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.kafka.test)
    testImplementation(libs.kotest.extensions.spring)
}

tasks.bootJar {
    archiveBaseName.set("inventory")
}
