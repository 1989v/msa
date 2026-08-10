plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.kotlin.jpa) apply false
    alias(libs.plugins.kotlin.kapt) apply false
    // #23 흡수: KMP sim-core — 루트에서 버전 1회 해소(apply false)해야 서브프로젝트가
    // "plugin already on classpath with unknown version" 없이 적용 가능.
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
}

subprojects {
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

    // #23 흡수: KMP 모듈은 kotlin.multiplatform 을 자체 적용하며 일괄 kotlin.jvm 과 상호배타다.
    // group/version/repositories 는 공통으로 받고, 아래 JVM/Spring 전용 설정만 건너뛴다.
    if (path in setOf(":game:sim", ":game:web")) return@subprojects

    apply(plugin = "org.jetbrains.kotlin.jvm")
    apply(plugin = "io.spring.dependency-management")

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
        dependencies {
            // opensearch-java 3.8 transport 는 httpclient5 5.6 / httpcore5 5.4.x 기준으로 빌드됨.
            // Boot BOM 이 httpcore5 를 5.3.6 으로 다운그레이드하면 async H2 경로에서
            // NoSuchMethodError(ClientH2UpgradeHandler) — 로컬 E2E 에서 확인 (ADR-0055/0059).
            dependency("org.apache.httpcomponents.client5:httpclient5:${rootProject.libs.versions.httpclient5.get()}")
            dependency("org.apache.httpcomponents.core5:httpcore5:5.4.2")
            dependency("org.apache.httpcomponents.core5:httpcore5-h2:5.4.2")
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

/**
 * Flyway 마이그레이션이 실제로 실행되는지 검증한다.
 *
 * Spring Boot 4 부터 Flyway 자동설정이 `spring-boot-flyway` 모듈로 분리됐다.
 * `org.flywaydb:flyway-core` 만 선언하면 **아무 경고 없이 마이그레이션이 그냥 실행되지 않는다** —
 * 앱은 정상 기동하고 `ddl-auto` 가 스키마를 만들어버려 한참 뒤에야 드러난다.
 * 실제로 운영 스키마 15개 중 13개가 이 상태였다(2026-08-09 실측: flyway_schema_history 부재).
 *
 * 마이그레이션을 실행하는 길은 둘이고, 둘 중 하나는 있어야 한다:
 *   1. `spring-boot-flyway` 자동설정 — 단독 앱의 정상 경로
 *   2. `ScopedFlywayMigrator` 직접 등록 — 폴드된 앱(ADR-0058)의 경로.
 *      한 클래스패스에 도메인별 `V1__…` 이 공존해 자동설정으로는 버전이 충돌한다.
 *
 * ClickHouse 처럼 Flyway 가 지원하지 않는 대상은 `db/migration-clickhouse` 같은 별도 이름을
 * 쓰고 파일 상단에 적용 방법을 적어 둔다 — 이 검사는 `migration` 디렉터리의 .sql 만 본다.
 */
val flywayNotWiredYet = emptySet<String>()

val verifyFlywayWiring by tasks.registering {
    group = "verification"
    description = "마이그레이션을 가진 모듈이 Flyway 를 실제로 실행하는지 확인"
    doLast {
        val offenders = subprojects.filter { sp ->
            val res = sp.file("src/main/resources")
            val hasMigrations = res.walkTopDown()
                .any { it.isFile && it.extension == "sql" && it.parentFile.name == "migration" }
            if (!hasMigrations) return@filter false
            val autoConfigured = sp.configurations.findByName("runtimeClasspath")
                ?.allDependencies
                ?.any { it.group == "org.springframework.boot" && it.name == "spring-boot-flyway" } == true
            val explicitMigrator = sp.file("src/main/kotlin").walkTopDown()
                .any { it.isFile && it.extension == "kt" && it.readText().contains("ScopedFlywayMigrator") }
            !(autoConfigured || explicitMigrator) && sp.name !in flywayNotWiredYet
        }
        if (offenders.isNotEmpty()) {
            throw GradleException(
                offenders.joinToString(
                    prefix = "Flyway 마이그레이션이 실행되지 않는 모듈:\n  ",
                    separator = "\n  ",
                    postfix = "\n\n단독 앱이면 implementation(\"org.springframework.boot:spring-boot-flyway\") 를, " +
                        "폴드된 앱이면 ScopedFlywayMigrator 빈을 추가할 것.",
                ) { it.path },
            )
        }
    }
}

// 루트에는 check 태스크가 없다 — 서브프로젝트의 check 에 붙여 ./gradlew build 로 함께 돈다.
subprojects { plugins.withId("java") { tasks.named("check") { dependsOn(verifyFlywayWiring) } } }
