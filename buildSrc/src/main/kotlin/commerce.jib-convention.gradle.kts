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
val mainClassByImage: Map<String, String> = mapOf(
    "gateway" to "com.kgd.gateway.GatewayApplicationKt",
    "product" to "com.kgd.product.ProductApplicationKt",
    "order" to "com.kgd.order.OrderApplicationKt",
    "search" to "com.kgd.search.SearchApplicationKt",
    "search-consumer" to "com.kgd.search.SearchConsumerApplicationKt",
    "search-batch" to "com.kgd.search.SearchBatchApplicationKt",
    "auth" to "com.kgd.auth.AuthApplicationKt",
    "member" to "com.kgd.member.MemberApplicationKt",
    "wishlist" to "com.kgd.wishlist.WishlistApplicationKt",
    "gifticon" to "com.kgd.gifticon.GifticonApplicationKt",
    "inventory" to "com.kgd.inventory.InventoryApplicationKt",
    "fulfillment" to "com.kgd.fulfillment.FulfillmentApplicationKt",
    "warehouse" to "com.kgd.warehouse.WarehouseApplicationKt",
    "analytics" to "com.kgd.analytics.AnalyticsApplicationKt",
    "experiment" to "com.kgd.experiment.ExperimentApplicationKt",
    "chatbot" to "com.kgd.chatbot.ChatbotApplicationKt",
    "code-dictionary" to "com.kgd.codedictionary.CodeDictionaryApplicationKt",
    "agent-viewer-api" to "com.kgd.agentviewer.AgentViewerApplicationKt",
    "quant" to "com.kgd.quant.QuantApplicationKt",
    "recommendation" to "com.kgd.recommendation.RecommendationApplicationKt"
)

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
    logger.info(
        "Skipping Jib convention for '{}' — no main class mapped (library module).",
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
            image = "$jibRegistry/$serviceImageName"
            // Tags: CI 가 sha 태그 주입한 경우 sha 만, 아니면 project version 만.
            // "latest" 는 제거 — OCIR 에서 동시 manifest write 시 충돌 가능 +
            // k8s manifest 는 어차피 sha 태그로 핀닝되어 latest 무의미.
            tags = if (jibCustomTag != null) {
                setOf(jibCustomTag!!)
            } else {
                setOf(project.version.toString())
            }
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
