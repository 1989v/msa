plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(libs.spring.cloud.eureka.server)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.spring.boot.starter.test)
}
