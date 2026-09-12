import com.google.cloud.tools.jib.gradle.JibExtension

plugins {
    id("com.google.cloud.tools.jib")
}

// Service image name derived from the Gradle path.
// Rule: strip ":app" suffix for main app modules; replace ":" with "-" for others.
//   :product:app       -> product
//   :gateway           -> gateway
//   :search:app        -> search
//   :search:consumer   -> search-consumer
//   :agent-viewer:api  -> agent-viewer-api
val serviceImageName: String = project.path
    .removePrefix(":")
    .let { path ->
        if (path.endsWith(":app")) path.removeSuffix(":app").replace(':', '-')
        else path.replace(':', '-')
    }

// Explicit main class map. Naming is not uniform because Kotlin/Java packages
// cannot contain hyphens, so `code-dictionary` becomes package `codedictionary`
// and `agent-viewer` becomes `agentviewer`. Kotlin top-level `fun main()`
// compiles to a generated class with the `Kt` suffix.
// 폴드 호스트 매핑은 생성물에서 읽는다 (gradle/topology.properties).
// 손으로 유지하다 빠뜨리면 jib 이 조용히 SKIPPED 되고 이미지가 안 나온다.
private val generatedMainClasses: Map<String, String> =
    rootProject.file("gradle/topology.properties").takeIf { it.isFile }?.let { f ->
        java.util.Properties().apply { f.inputStream().use { load(it) } }
            .entries.mapNotNull { (k, v) ->
                Regex("^pod\\.(.+)\\.mainClass$").find(k.toString())
                    ?.groupValues?.get(1)?.let { it to v.toString() }
            }.toMap()
    }.orEmpty()

/** 폴드 규칙 밖의 배포 단위 — :{x}:app 이 아니라 생성물에 안 들어간다. */
private val extraMainClasses: Map<String, String> = mapOf(
    "gateway" to "com.kgd.gateway.GatewayApplicationKt",
    "search-consumer" to "com.kgd.search.SearchConsumerApplicationKt",
    "search-batch" to "com.kgd.search.SearchBatchApplicationKt",
    "agent-viewer-api" to "com.kgd.agentviewer.AgentViewerApplicationKt",
)

val mainClassByImage: Map<String, String> = generatedMainClasses + extraMainClasses

val resolvedMainClass: String? = mainClassByImage[serviceImageName]
val jibRegistry: String = (project.findProperty("jibRegistry") as String?) ?: "commerce"
// Custom tag (e.g. CI commit SHA) overrides the default version-based tag.
// Usage: ./gradlew jib -PjibTag=abc1234
val jibCustomTag: String? = project.findProperty("jibTag") as String?
// Target platforms — 기본값은 arm64 단일 (OCI Ampere A1 만 사용).
// amd64 도 필요해지면 -PjibPlatforms="linux/amd64,linux/arm64" 로 multi-arch 빌드.
// 형식: "os/arch[,os/arch...]"
val jibPlatforms: List<Pair<String, String>> = (project.findProperty("jibPlatforms") as String?)
    ?.split(",")
    ?.map { it.trim() }
    ?.filter { it.isNotBlank() }
    ?.map { spec ->
        val parts = spec.split("/", limit = 2)
        parts[0] to parts.getOrElse(1) { "arm64" }   // os to arch
    }
    ?: listOf("linux" to "arm64")

if (resolvedMainClass == null) {
    // Library modules (like :common) apply the Spring Boot plugin for dependency
    // management and auto-configuration, but disable bootJar because they are
    // not runnable apps. Disable the Jib tasks for those — they have no main
    // class and produce no image.
    // **경고로 낸다.** 폴드 호스트를 새로 만들고 이 표에 안 넣으면 jib 이 조용히 SKIPPED 되고,
    // CI 는 성공으로 끝난 뒤 매니페스트 태그만 올려 ErrImagePull 을 만든다(ADR-0093 에서 겪음).
    // 라이브러리 모듈이면 이 줄이 정상이고, 배포 단위인데 보이면 표에 항목이 빠진 것이다.
    logger.warn(
        "Jib disabled for '{}' — no main class mapped. 라이브러리면 정상, 배포 단위면 mainClassByImage 에 추가하라.",
        serviceImageName
    )
    tasks.matching { it.name in setOf("jib", "jibBuildTar", "jibDockerBuild") }.configureEach {
        enabled = false
    }
} else {
    configure<JibExtension> {
        from {
            image = "eclipse-temurin:25-jre-alpine"
            platforms {
                jibPlatforms.forEach { (osName, archName) ->
                    platform {
                        os = osName
                        architecture = archName
                    }
                }
            }
        }
        to {
            // Jib 는 image 에 태그 없으면 자동으로 `latest` 를 기본 태그로 추가함.
            // OCIR 동시 manifest write 충돌 회피 + k8s manifest 는 sha 로 pin 되어
            // latest 가 무의미하므로 image URL 에 직접 태그를 박아 latest 자동 추가
            // 자체를 차단.
            val effectiveTag: String = jibCustomTag ?: project.version.toString()
            image = "$jibRegistry/$serviceImageName:$effectiveTag"
            // tags 비워둠 — image 의 태그 하나만 push.
        }
        container {
            mainClass = resolvedMainClass
            jvmFlags = listOf(
                "-XX:+UseContainerSupport",
                "-XX:MaxRAMPercentage=75.0",
                "-Djava.security.egd=file:/dev/./urandom"
            )
            user = "1000:1000"
            creationTime.set("USE_CURRENT_TIMESTAMP")
            labels.set(
                mapOf(
                    "org.opencontainers.image.source" to "https://github.com/1989v/msa",
                    "org.opencontainers.image.vendor" to "kgd",
                    "org.opencontainers.image.title" to serviceImageName
                )
            )
        }
    }
}
