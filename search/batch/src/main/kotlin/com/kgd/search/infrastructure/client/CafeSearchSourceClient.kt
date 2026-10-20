package com.kgd.search.infrastructure.client

import com.kgd.search.infrastructure.indexing.UnifiedIndexDocument
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import tools.jackson.databind.JsonNode
import java.security.MessageDigest
import java.time.Duration

/** Cafe public API projection. No new index fields: comparison axes live in existing facets. */
@Component
class CafeSearchSourceClient(@Qualifier("placeWebClient") private val client: WebClient) {
    suspend fun fetch(): List<UnifiedIndexDocument> {
        val docs = mutableListOf<UnifiedIndexDocument>()
        val ids = mutableSetOf<String>()
        var page = 0
        var expected: Long? = null
        do {
            val response = client.get().uri("/api/v1/ranking/cafe/drinks?page=$page&size=100").retrieve()
                .bodyToMono(JsonNode::class.java).timeout(Duration.ofSeconds(30)).awaitSingle()
            check(response.get("success")?.asBoolean() == true) { "Cafe source failed" }
            val data = requireNotNull(response.get("data"))
            val items = requireNotNull(data.get("content"))
            check(items.isArray) { "Missing cafe source content" }
            val total = requireNotNull(data.get("totalElements")?.takeIf { it.isNumber }?.asLong())
            check(total > 0 && (expected == null || expected == total) && !items.isEmpty) { "Empty/changing cafe source" }
            expected = total
            for (item in items) {
                val brand = item.text("brandSlug")
                val menu = item.text("menuName")
                val key = listOf(brand, menu, item.optionalText("temperature"), item.optionalText("sizeLabel"), item.text("caffeineStatus")).joinToString("\u0000")
                val id = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
                check(ids.add(id)) { "Duplicate cafe source identity" }
                docs += UnifiedIndexDocument(id = "cafe_drink:$id", type = "cafe_drink", sourceId = id, slug = id, lang = "ko", title = menu,
                    titleEn = item.optionalText("menuNameEn"), summary = listOfNotNull(item.text("brandName"), item.optionalText("temperature"), item.optionalText("sizeLabel")).joinToString(" · "),
                    facets = mapOf("group" to item.text("drinkGroup"), "brand" to brand))
            }
            check(docs.size <= total && (docs.size.toLong() == total || items.size() == 100)) { "Truncated cafe source" }
            check(++page <= 10000) { "Cafe source exceeds scan bound" }
        } while (docs.size.toLong() < requireNotNull(expected))
        return docs
    }
    private fun JsonNode.optionalText(key: String): String? = get(key)?.takeUnless { it.isNull }?.asText()
    private fun JsonNode.text(key: String): String = requireNotNull(optionalText(key)?.takeIf { it.isNotBlank() }) { "Missing cafe $key" }
}
