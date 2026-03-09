plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":search:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.boot.starter.data.elasticsearch)
    implementation(libs.spring.boot.starter.batch)
    implementation(libs.spring.webflux)
    implementation(libs.kotlin.coroutines.reactor)
    runtimeOnly(libs.h2)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.spring.batch.test)
}

tasks.bootJar {
    archiveBaseName.set("search-batch")
}
