package com.kgd.chatbot.infrastructure.knowledge

import com.kgd.chatbot.application.chat.port.KnowledgeChunk
import com.kgd.chatbot.application.chat.port.KnowledgeSourcePort
import com.kgd.chatbot.config.ChatbotProperties
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.*

@Component
class FileSystemKnowledgeAdapter(
    private val properties: ChatbotProperties
) : KnowledgeSourcePort {

    private val log = LoggerFactory.getLogger(javaClass)

    private data class Document(
        val title: String,
        val content: String,
        val source: String,
        val category: String,
        val keywords: Set<String>
    )

    @Volatile
    private var documents: List<Document> = emptyList()

    @PostConstruct
    fun init() {
        reload()
    }

    @Scheduled(fixedDelay = 300_000) // 5분마다
    override fun reload() {
        val docsRoot = Path.of(properties.knowledge.docsRoot)
        if (!docsRoot.exists()) {
            log.warn("문서 루트 디렉토리가 없습니다: {}", docsRoot)
            return
        }

        val loaded = mutableListOf<Document>()

        properties.knowledge.categories.forEach { (category, pathPattern) ->
            pathPattern.split(",").map { it.trim() }.forEach { pattern ->
                val dir = docsRoot.resolve(pattern)
                if (dir.exists()) {
                    loadDirectory(dir, category, loaded)
                } else {
                    // 단일 파일 경로일 수 있음
                    val file = docsRoot.resolve(pattern)
                    if (file.isRegularFile()) {
                        loadFile(file, category, loaded)
                    }
                }
            }
        }

        documents = loaded
        log.info("문서 로드 완료: {} 파일, {} 카테고리", loaded.size, getCategories().size)
    }

    override fun search(query: String, maxResults: Int): List<KnowledgeChunk> {
        val queryKeywords = extractKeywords(query)

        return documents
            .map { doc ->
                val matchCount = queryKeywords.count { keyword ->
                    doc.keywords.any { it.contains(keyword) } ||
                        doc.content.lowercase().contains(keyword)
                }
                doc to matchCount
            }
            .filter { it.second > 0 }
            .sortedByDescending { it.second }
            .take(maxResults)
            .map { (doc, _) ->
                KnowledgeChunk(
                    title = doc.title,
                    content = doc.content,
                    source = doc.source,
                    category = doc.category
                )
            }
    }

    override fun getCategories(): List<String> =
        documents.map { it.category }.distinct()

    private fun loadDirectory(dir: Path, category: String, target: MutableList<Document>) {
        Files.walk(dir)
            .filter { it.isRegularFile() && it.extension in setOf("md", "yml", "yaml") }
            .filter { !it.name.startsWith("_") }
            .forEach { loadFile(it, category, target) }
    }

    private fun loadFile(file: Path, category: String, target: MutableList<Document>) {
        try {
            val content = file.readText()
            if (content.isBlank()) return

            val relativePath = Path.of(properties.knowledge.docsRoot)
                .relativize(file).toString()

            target.add(
                Document(
                    title = file.nameWithoutExtension.replace("-", " "),
                    content = content,
                    source = relativePath,
                    category = category,
                    keywords = extractKeywords(content)
                )
            )
        } catch (e: Exception) {
            log.warn("파일 로드 실패: {}", file, e)
        }
    }

    private fun extractKeywords(text: String): Set<String> {
        return text.lowercase()
            .replace(Regex("[^a-z0-9가-힣\\s]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length >= 2 }
            .toSet()
    }
}
