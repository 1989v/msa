plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":seven-split:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    // TG-04: application port 시그니처가 Coroutine(suspend, Flow) 기반이므로 명시적으로 도입.
    // spring-boot-starter-web 은 Reactor 코루틴을 전이로 끌어오지 않는다.
    implementation(libs.kotlin.coroutines.core)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.kotest.property)
    testImplementation(libs.turbine)
    testRuntimeOnly(libs.h2)
}

tasks.bootJar {
    archiveBaseName.set("seven-split")
}
