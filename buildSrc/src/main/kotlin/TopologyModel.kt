/**
 * 폴드 배치의 단일 원본을 소스에서 읽는다.
 *
 * 「어느 도메인이 어느 파드에 있나」가 여러 곳에 손으로 적혀 각자 낡는 것이 ADR-0093 에서
 * 반복해 나온 결함의 뿌리다. 원본은 둘뿐이다 — settings.gradle.kts 의 `:{x}:app` 목록과
 * 호스트 앱의 scanBasePackages. 나머지는 여기서 파생한다.
 */
data class Pod(
    val name: String,
    val mainClass: String,
    /** 이 파드가 담은 도메인 모듈 디렉토리. 자기 도메인이 없는 순수 aggregator 면 비어 있다 */
    val domains: List<String>,
)

object TopologyModel {

    fun read(rootDir: java.io.File): List<Pod> {
        val declared = Regex("\"([a-z0-9-]+):app\"")
            .findAll(rootDir.resolve("settings.gradle.kts").readText())
            .map { it.groupValues[1] }
            .toSortedSet()

        val moduleDirs = rootDir.listFiles()
            ?.filter { it.isDirectory && it.resolve("feature/src/main").isDirectory }
            ?.map { it.name }
            .orEmpty()

        return declared.mapNotNull { pod ->
            val appSrc = rootDir.resolve("$pod/app/src/main/kotlin")
            if (!appSrc.isDirectory) return@mapNotNull null
            val appFile = appSrc.walkTopDown()
                .firstOrNull { it.isFile && it.name.endsWith("Application.kt") }
                ?: return@mapNotNull null
            val text = appFile.readText()

            val pkg = Regex("""^package\s+([\w.]+)""", RegexOption.MULTILINE).find(text)?.groupValues?.get(1)
            val cls = Regex("""^class\s+(\w+)|^@SpringBootApplication[\s\S]*?\nclass\s+(\w+)""", RegexOption.MULTILINE)
                .find(text)?.let { it.groupValues[1].ifEmpty { it.groupValues[2] } }
                ?: appFile.nameWithoutExtension
            val mainClass = "$pkg.${appFile.nameWithoutExtension}Kt"

            val scanned = Regex("\"com\\.kgd\\.(\\w+)\"").findAll(text)
                .map { it.groupValues[1] }
                .filter { it != "common" }
                .toSortedSet()
            val domains = scanned.mapNotNull { s -> moduleDirs.firstOrNull { it.replace("-", "") == s } }

            Pod(pod, mainClass, domains.sorted())
        }
    }
}
