plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.kotlin.jpa) apply false
    alias(libs.plugins.kotlin.kapt) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
}

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")
    apply(plugin = "io.spring.dependency-management")

    // ADR-0058: nested submodule(:svc:domain / :svc:app) 의 leaf 이름이 전부 domain/app 으로
    // 동일 → 단일 group 이면 com.kgd:domain 좌표 충돌로 한 app 이 두 도메인을 동시에 의존할 때
    // (commerce 모듈러 모놀리스) Gradle 이 하나로 합쳐버린다. group 을 부모 경로로 고유화한다.
    // 이미지명은 jib-convention 이 Gradle 경로에서 파생하므로 group 변경의 영향 없음.
    group = if (parent == null || parent == rootProject) "com.kgd" else "com.kgd.${parent!!.name}"
    version = "0.0.1-SNAPSHOT"

    // ADR-0058: 중첩 feature/domain 모듈은 leaf 이름이 전부 feature/domain → archivesName 미설정 시
    // jar 가 동명(feature-*-plain.jar / domain-*-plain.jar). commerce:app(4 도메인 폴드)의 bootJar 가
    // BOOT-INF/lib 에 동명을 여럿 넣어 "duplicate" 로 실패한다. 부모 경로로 jar 이름을 고유화.
    // (jib 기본 exploded 경로는 project 모듈을 클래스로 적재해 영향 없음 — 이미지 빌드는 정상.)
    if (name == "feature" || name == "domain") {
        plugins.withType<org.gradle.api.plugins.BasePlugin> {
            extensions.configure<org.gradle.api.plugins.BasePluginExtension>("base") {
                archivesName.set("${parent!!.name}-$name")
            }
        }
    }

    repositories {
        mavenCentral()
    }

    pluginManager.withPlugin("org.jetbrains.kotlin.jvm") {
        extensions.configure<org.gradle.api.plugins.JavaPluginExtension>("java") {
            toolchain {
                languageVersion.set(JavaLanguageVersion.of(25))
            }
        }
    }

    the<io.spring.gradle.dependencymanagement.dsl.DependencyManagementExtension>().apply {
        imports {
            mavenBom("org.springframework.boot:spring-boot-dependencies:${rootProject.libs.versions.springBoot.get()}")
            mavenBom("org.springframework.cloud:spring-cloud-dependencies:${rootProject.libs.versions.springCloud.get()}")
        }
    }

    dependencies {
        "implementation"(rootProject.libs.kotlin.reflect)
        "testImplementation"(rootProject.libs.kotest.runner.junit5)
        "testImplementation"(rootProject.libs.kotest.assertions.core)
        "testImplementation"(rootProject.libs.mockk)
    }

    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        compilerOptions {
            freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_24)
        }
    }

    // Kotlin max JVM target is 24 while toolchain is 25; align Java bytecode to 24 to match.
    tasks.withType<JavaCompile> {
        options.release.set(24)
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }

    // Apply Jib convention to every Spring Boot app module (ADR-0019).
    // The convention sets base image, JVM flags, OCI labels, and image naming.
    // Per-service overrides (e.g. container.ports) belong in the module's own build.gradle.kts.
    pluginManager.withPlugin("org.springframework.boot") {
        apply(plugin = "commerce.jib-convention")
    }
}
