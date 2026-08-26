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

/**
 * 외부 API 호출이 쿼터 게이트를 거치는지 검증한다 (ADR-0082 §6).
 *
 * 필터·인터셉터를 아무리 잘 만들어도 이 한 줄이면 무력화된다:
 *
 *   private val webClient = WebClient.builder().build()   // 공용 팩토리를 안 거친다
 *
 * 그래서 "외부 API 호스트를 직접 부르는 모듈은 provider 를 참조해야 한다"를 빌드가 강제한다.
 * 문서와 리뷰는 사람이 빠뜨리지만 빌드는 안 빠뜨린다 (verifyFlywayWiring 과 같은 패턴).
 *
 * 텍스트 스캔이라 정밀하지 않다 — 그래서 **호스트 문자열**이라는 좁고 구체적인 신호만 본다.
 * 오탐이 잦으면 사람들이 허용목록으로 통과시키고, 그 순간 검사는 없는 것이 된다.
 */
val externalApiHosts = listOf(
    "openapi.naver.com",        // 네이버 검색
    "googleapis.com",           // YouTube Data / Places / Directions
    "apis.data.go.kr",          // 공공데이터포털
)

/**
 * 게이트를 정의하는 모듈 자신과, 호스트를 문서/설정으로만 다루는 모듈.
 * **항목마다 왜인지 남긴다** — 이유 없는 예외가 쌓이면 검사가 죽는다.
 */
val quotaGateExempt = setOf(
    "common",   // 게이트 구현체가 사는 곳
)

val verifyExternalApiQuota by tasks.registering {
    group = "verification"
    description = "외부 API 호스트를 직접 호출하는 모듈이 쿼터 게이트를 참조하는지 확인"
    doLast {
        val offenders = subprojects.filter { sp ->
            if (sp.name in quotaGateExempt) return@filter false
            val src = sp.file("src/main")
            if (!src.exists()) return@filter false

            var callsExternal = false
            var referencesGate = false
            src.walkTopDown()
                .filter { it.isFile && it.extension in setOf("kt", "java", "py") }
                .forEach { f ->
                    val text = f.readText()
                    if (externalApiHosts.any { host -> text.contains(host) }) callsExternal = true
                    if (text.contains("ExternalApiProvider")) referencesGate = true
                }
            callsExternal && !referencesGate
        }
        if (offenders.isNotEmpty()) {
            throw GradleException(
                offenders.joinToString(
                    prefix = "외부 API 를 부르면서 쿼터 게이트를 안 타는 모듈:\n  ",
                    separator = "\n  ",
                    postfix = "\n\nWebClient 면 ExternalApiQuotaGuards.filter(provider, ledger) 를 " +
                        "ExchangeFilterFunction 으로 걸고,\nRestClient 면 .interceptor(...) 를 붙일 것 " +
                        "(ADR-0082). 논블로킹에 AOP 를 쓰면 재시도를 못 센다.",
                ) { it.path },
            )
        }
    }
}

subprojects { plugins.withId("java") { tasks.named("check") { dependsOn(verifyExternalApiQuota) } } }

/**
 * 레이어 의존 규칙을 빌드에서 강제한다 (ADR-0083 §5).
 *
 * 문서(package-structure.md)와 리뷰만으로는 지켜지지 않았다 — 가장 최근에 만든 세 도메인이
 * 서비스에 JpaRepository 를 직접 주입한 채 리뷰를 통과했다. 규칙은 셋이고 전부 침묵하는 위반이다.
 *
 *   ① application 패키지가 infrastructure 를 import 하지 않는다
 *   ② :*:domain 모듈이 Spring/JPA 를 선언하지 않는다 (의존성 그래프 — 텍스트보다 정확)
 *   ③ 파일 경로에서 유도한 패키지 == package 선언
 *
 * 기존 위반은 모듈 단위 허용목록으로 통과시킨다. **항목마다 왜·어느 단계에서 비우는지 적는다**
 * (docs/plans/2026-08-26-layer-structure-alignment.md). 비운 항목은 다시 넣지 않는다 —
 * 허용목록이 "일단 통과" 창구가 되는 순간 이 검사는 없는 것이 된다.
 */
val layerGateOutside = setOf(
    ":gateway",          // 인프라 단일 모듈 — 레이어 없음
    ":common",           // 공유 라이브러리
    ":agent-viewer:api", // 개발 도구, 플랫폼 서비스 아님
    ":game:sim",         // KMP
    ":game:web",         // KMP
)

// ① 허용목록 — 비어 있어야 정상
val layerImportExempt = mapOf<String, String>(
    // 2026-08-26 P4 완료 — 비어 있어야 정상. 새 항목을 넣지 않는다
)

// ② 허용목록 — 영구 예외 하나뿐
val domainFrameworkExempt = mapOf(
    ":search:domain" to "Page/Pageable 포트 시그니처 — 문서화된 유일한 예외 (package-structure.md)",
)

// ③ 허용목록 — 비어 있어야 정상
// ④ 허용목록 — 비어 있어야 정상
val useCaseGateExempt = mapOf<String, String>(
    // 2026-08-26 P7·P9 완료 — 비어 있어야 정상. 새 항목을 넣지 않는다
)

val dirPackageExempt = mapOf<String, String>(
    // 2026-08-26 P3 완료 — 변종 D 120+17 파일 git mv. 새 항목을 넣지 않는다
)

val verifyLayerDependencies by tasks.registering {
    group = "verification"
    description = "application→infrastructure import · domain 프레임워크 의존 · 디렉토리==패키지 를 확인 (ADR-0083)"
    doLast {
        val packageLine = Regex("""^package\s+([\w.]+)""", RegexOption.MULTILINE)
        // application 이 인프라에 닿는 경로는 둘이다 — 남의 infrastructure 패키지를 부르거나,
        // 자기 패키지 안에 JPA 를 직접 들이거나(`interface XRepo : JpaRepository<…>`).
        // 후자는 `com.kgd.*.infrastructure.` 가 한 번도 안 나와 첫 정규식만으로는 통과한다.
        // 마지막 패키지 세그먼트가 service 인 것만 — code-dictionary 에는 `service` 라는 **엔티티**가 있어
        // `application.service.dto.X` 를 레이어로 오인하면 안 된다. 뒤에 대문자(타입명)를 요구해 가른다.
        val ctorParams = Regex("""^class (\w+)\(([^)]*)\)""", setOf(RegexOption.MULTILINE, RegexOption.DOT_MATCHES_ALL))
        val injectedType = Regex(""":\s*([A-Z]\w*)""")
        // presentation 이 주입해도 되는 선언 위치: 인바운드 포트(usecase) · 프레젠테이션 로컬 · 설정값
        val presentationAllowedPkg = listOf(".usecase.", ".presentation.", ".config.")
        // com.kgd.* 최상위 선언 → 선언 패키지. 타입 이름만으로 '어느 레이어에서 온 것인지' 를 판정한다
        val kgdDeclarations: Map<String, String> = subprojects
            .mapNotNull { it.file("src/main/kotlin").takeIf(File::exists) }
            .flatMap { it.walkTopDown().filter { f -> f.isFile && f.extension == "kt" }.toList() }
            .fold(mutableMapOf()) { acc, f ->
                val text = f.readText()
                val pkg = Regex("""^package (com\.kgd\.[\w.]+)""", RegexOption.MULTILINE)
                    .find(text)?.groupValues?.get(1)
                if (pkg != null) {
                    Regex(
                        """^(?:@\w+(?:\([^)]*\))?\s*)*(?:data |enum |sealed |value |abstract |open )*(?:class|interface|object) (\w+)""",
                        RegexOption.MULTILINE,
                    ).findAll(text).forEach { m -> acc.putIfAbsent(m.groupValues[1], pkg) }
                }
                acc
            }
        val serviceImport = Regex(
            """^import\s+com\.kgd\.\w+\.application\.[\w.]*service\.[A-Z]""",
            RegexOption.MULTILINE,
        )
        val infraImport = Regex(
            """^import\s+(com\.kgd\.\w+\.infrastructure\.|org\.springframework\.data\.jpa\.|jakarta\.persistence\.)""",
            RegexOption.MULTILINE,
        )
        val failures = mutableListOf<String>()

        subprojects.filter { it.path !in layerGateOutside }.forEach { sp ->
            val srcRoot = sp.file("src/main/kotlin")
            if (!srcRoot.exists()) return@forEach
            val ktFiles = srcRoot.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

            // ① application → infrastructure
            if (sp.path !in layerImportExempt) {
                ktFiles.forEach { f ->
                    val text = f.readText()
                    val pkg = packageLine.find(text)?.groupValues?.get(1) ?: return@forEach
                    // presentation 도 같은 규칙 — 컨트롤러가 JpaRepository/어댑터를 직접 부르면
                    // application 을 통째로 건너뛴 것이라 변종 C 보다 나쁘다
                    val layer = when {
                        ".application." in "$pkg." -> "application"
                        ".presentation." in "$pkg." -> "presentation"
                        else -> null
                    }
                    if (layer != null && infraImport.containsMatchIn(text)) {
                        failures += "[① $layer→infrastructure] ${sp.path}: ${f.relativeTo(srcRoot)}"
                    }
                }
            }

            // ② domain 모듈의 프레임워크 선언 (의존성 그래프)
            if (sp.name == "domain" && sp.path !in domainFrameworkExempt) {
                val leaked = sp.configurations.findByName("runtimeClasspath")
                    ?.allDependencies
                    ?.filter { d ->
                        val g = d.group ?: return@filter false
                        g.startsWith("org.springframework") || g == "jakarta.persistence"
                    }
                    .orEmpty()
                leaked.forEach { failures += "[② domain 프레임워크] ${sp.path}: ${it.group}:${it.name}" }
            }

            // ③ 디렉토리 == 패키지
            if (sp.path !in dirPackageExempt) {
                ktFiles.forEach { f ->
                    val declared = packageLine.find(f.readText())?.groupValues?.get(1) ?: return@forEach
                    val expected = f.parentFile.relativeTo(srcRoot).path.replace(File.separatorChar, '.')
                    if (declared != expected) {
                        failures += "[③ 디렉토리≠패키지] ${sp.path}: ${f.relativeTo(srcRoot)} 는 $declared"
                    }
                }
            }

            // ⑤ presentation 생성자에는 UseCase 인터페이스만 — 레이아웃과 무관하게 본다
            //    ④는 `service` 라는 패키지 이름에 기대므로, UseCase 와 구현이 같은 패키지에 사는
            //    레이아웃에서는 못 잡는다 (quant 가 그랬다). 이 규칙은 주입 '타입이 어디 선언됐는지' 를 본다.
            if (sp.path !in useCaseGateExempt) {
                ktFiles.forEach { f ->
                    val text = f.readText()
                    val pkg = packageLine.find(text)?.groupValues?.get(1) ?: return@forEach
                    if (".presentation." !in "$pkg.") return@forEach
                    ctorParams.findAll(text).forEach { ctor ->
                        injectedType.findAll(ctor.groupValues[2]).forEach { t ->
                            val declared = kgdDeclarations[t.groupValues[1]] ?: return@forEach
                            val ok = presentationAllowedPkg.any { it in "$declared." }
                            if (!ok) {
                                failures += "[⑤ presentation 주입] ${sp.path}: ${f.relativeTo(srcRoot)} ← " +
                                    "${t.groupValues[1]} ($declared)"
                            }
                        }
                    }
                }
            }

            // ④ presentation 은 application 의 service 구현이 아니라 usecase 인터페이스를 본다
            if (sp.path !in useCaseGateExempt) {
                ktFiles.forEach { f ->
                    val text = f.readText()
                    val pkg = packageLine.find(text)?.groupValues?.get(1) ?: return@forEach
                    if (".presentation." !in "$pkg." ) return@forEach
                    if (serviceImport.containsMatchIn(text)) {
                        failures += "[④ presentation→application.service] ${sp.path}: ${f.relativeTo(srcRoot)}"
                    }
                }
            }
        }

        if (failures.isNotEmpty()) {
            throw GradleException(
                failures.joinToString(
                    prefix = "레이어 규칙 위반 (ADR-0083):\n  ",
                    separator = "\n  ",
                    postfix = "\n\n① 서비스는 application/{entity}/port 의 Port 만 주입하고 Adapter 가 infrastructure 에서 구현한다.\n" +
                        "② domain 모듈의 build.gradle.kts 에서 Spring/JPA 의존을 뺀다.\n" +
                        "③ 파일을 package 선언과 같은 디렉토리로 git mv 한다 (package 은 그대로).\n" +
                        "④ 컨트롤러는 application/{entity}/usecase 의 UseCase 인터페이스를 주입한다. DTO 가 service 패키지에\n" +
                        "   있으면 dto 로 옮긴다 — 구현을 부르는 것과 타입을 쓰는 것은 다르지만 위치가 같으면 구분이 안 된다.\n" +
                        "기존 위반의 정리 순서: docs/plans/2026-08-26-layer-structure-alignment.md",
                ),
            )
        }
    }
}

subprojects { plugins.withId("java") { tasks.named("check") { dependsOn(verifyLayerDependencies) } } }

// ─────────────────────────────────────────────────────────────────────────────
// 검색 인덱스 계약 — 매핑 JSON 과 Kotlin 문서 클래스가 어긋나지 않는지 (ADR-0055/0065)
//
// 인덱스마다 쓰기(:batch·:consumer)와 읽기(:app) 문서 클래스가 따로 있다. 별개 배포 단위라
// 클래스를 합치지 않는 것이 맞지만, 그러면 26개 필드가 여러 파일에 흩어진 채 **아무것도 어긋남을
// 잡지 않는다.** 특히 읽기 쪽은 @JsonIgnoreProperties(ignoreUnknown = true) 라 필드를 빠뜨려도
// 컴파일 에러가 아니라 조용히 기본값(0/null)으로 읽힌다 — 검색 결과의 값이 비어야 알아챈다.
//
// 계약의 SSOT 는 Kotlin 클래스가 아니라 매핑 JSON 이고, 이 검사는 각 클래스가 그 투영인지 본다.
//   쓰기 클래스 == 매핑 키 (정확히 같아야 한다 — 매핑에 없는 필드를 색인하거나, 선언된 필드를 비운다)
//   읽기 클래스 ⊆ 매핑 키 (빠진 것은 아래 allowlist 에 "왜" 를 적는다)
val searchIndexContracts = listOf(
    Triple("regions", "search/batch/src/main/resources/opensearch/regions-index.json", listOf(
        "search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/RegionIndexDocument.kt" to "write",
        "search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/RegionSearchDocument.kt" to "read",
    )),
    Triple("attractions", "search/batch/src/main/resources/opensearch/attractions-index.json", listOf(
        "search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/AttractionIndexDocument.kt" to "write",
        "search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocument.kt" to "read",
    )),
    Triple("products", "search/batch/src/main/resources/opensearch/products-index.json", listOf(
        "search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/ProductIndexDocument.kt" to "write",
        "search/consumer/src/main/kotlin/com/kgd/search/infrastructure/indexing/ProductIndexDocument.kt" to "write",
        "search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/ProductSearchDocument.kt" to "read",
    )),
)

// 읽기 클래스가 의도적으로 안 읽는 필드 — 항목마다 "왜" 를 적는다
val searchReadOmitted = mapOf(
    "attractions" to mapOf(
        "idSort" to "정렬 전용 색인 필드 — 응답에 쓰지 않는다",
        "titleJamo" to "자모 분해 검색 전용 — 응답에 쓰지 않는다",
    ),
)

val verifySearchIndexContract by tasks.registering {
    group = "verification"
    description = "OpenSearch 매핑 JSON 과 문서 클래스 필드가 일치하는지 확인 (ADR-0055/0065)"
    doLast {
        val valLine = Regex("""^\s+(?:@\w+(?:\([^)]*\))?\s+)*val\s+(\w+)\s*:""", RegexOption.MULTILINE)
        val failures = mutableListOf<String>()

        searchIndexContracts.forEach { (index, mappingPath, classes) ->
            val mappingFile = rootProject.file(mappingPath)
            if (!mappingFile.exists()) {
                failures += "[매핑 없음] $index: $mappingPath"
                return@forEach
            }
            @Suppress("UNCHECKED_CAST")
            val parsed = groovy.json.JsonSlurper().parse(mappingFile) as Map<String, Any?>
            val mappings = parsed["mappings"] as? Map<String, Any?>
            val mappingKeys = (mappings?.get("properties") as? Map<String, Any?>)?.keys?.toSortedSet()
            if (mappingKeys == null) {
                failures += "[매핑 형식] $index: mappings.properties 를 못 읽었다"
                return@forEach
            }

            classes.forEach { (classPath, role) ->
                val f = rootProject.file(classPath)
                if (!f.exists()) {
                    failures += "[클래스 없음] $index($role): $classPath"
                    return@forEach
                }
                // data class 본문의 val 만 — 중첩 타입(GeoPoint 등)은 별도 파일이라 섞이지 않는다
                val body = f.readText().substringAfter("data class ").substringAfter("(").substringBefore("\n)")
                val fields = valLine.findAll(body).map { it.groupValues[1] }.toSortedSet()
                val name = f.name.removeSuffix(".kt")

                val extra = fields - mappingKeys
                if (extra.isNotEmpty()) {
                    failures += "[$index/$role] $name 에 매핑에 없는 필드: ${extra.joinToString(", ")}"
                }
                val missing = mappingKeys - fields
                when (role) {
                    "write" -> if (missing.isNotEmpty()) {
                        failures += "[$index/write] $name 이 매핑 필드를 안 채운다: ${missing.joinToString(", ")}"
                    }
                    "read" -> {
                        val allowed = searchReadOmitted[index].orEmpty().keys
                        val unexplained = missing - allowed
                        if (unexplained.isNotEmpty()) {
                            failures += "[$index/read] $name 이 매핑 필드를 안 읽는다(이유 미기재): ${unexplained.joinToString(", ")}"
                        }
                    }
                }
            }
        }

        if (failures.isNotEmpty()) {
            throw GradleException(
                failures.joinToString(
                    prefix = "검색 인덱스 계약 불일치:\n  ",
                    separator = "\n  ",
                    postfix = "\n\n매핑 JSON(search/batch/src/main/resources/opensearch/)이 SSOT 다. 클래스를 그것에 맞춘다.\n" +
                        "읽기 쪽이 일부러 안 읽는 필드라면 루트 build.gradle.kts 의 searchReadOmitted 에 이유를 적는다.\n" +
                        "읽기 클래스는 ignoreUnknown = true 라 빠뜨려도 컴파일이 통과하고 값만 조용히 빈다.",
                ),
            )
        }
    }
}

subprojects { plugins.withId("java") { tasks.named("check") { dependsOn(verifySearchIndexContract) } } }

/**
 * 구조 게이트 묶음. pre-push 훅과 CI 는 **이 태스크 하나만** 부른다 —
 * 개별 이름을 부르면 게이트를 새로 만들 때 호출부에 추가하는 걸 잊고,
 * `check` 에만 달린 채 아무 데서도 안 도는 상태가 된다 (2026-08-26 실제로 그랬다).
 */
val verifyArchitecture by tasks.registering {
    group = "verification"
    description = "레이어·배선·쿼터·검색 인덱스 계약 게이트를 한 번에"
    dependsOn(verifyLayerDependencies, verifyFlywayWiring, verifyExternalApiQuota, verifySearchIndexContract)
}
