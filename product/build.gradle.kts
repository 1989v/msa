plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.cloud.eureka.client)
    implementation(libs.spring.kafka)
    implementation(libs.querydsl.jpa) { artifact { classifier = "jakarta" } }
    kapt(libs.querydsl.apt) { artifact { classifier = "jakarta" } }
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

// QueryDSL Q class generation path
kotlin.sourceSets.main { kotlin.srcDir("build/generated/source/kapt/main") }
