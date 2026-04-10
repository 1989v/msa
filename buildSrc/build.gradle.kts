plugins {
    `kotlin-dsl`
}

repositories {
    gradlePluginPortal()
    mavenCentral()
}

dependencies {
    implementation("com.google.cloud.tools:jib-gradle-plugin:3.4.4")
}
