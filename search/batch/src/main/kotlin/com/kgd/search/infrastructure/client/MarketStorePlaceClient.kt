package com.kgd.search.infrastructure.client

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import tools.jackson.databind.JsonNode
import java.time.Duration

/** The public API owns projection and the sole dishes.csv dictionary. */
@Component
class MarketStorePlaceClient(@Qualifier("placeWebClient") private val client: WebClient) {
    fun contentIds(): List<String> = data("/api/v1/place/markets/content-ids").toList().map { it.asText() }
    fun dishes(): JsonNode = data("/api/v1/place/markets/dishes")
    fun market(contentId: String, lang: String): JsonNode =
        data("/api/v1/place/markets/$contentId?lang=$lang")

    /** Only the discovery projection exposes market attraction references and regions. */
    fun marketMetadata(lang: String): Map<String, JsonNode> {
        val result = linkedMapOf<String, JsonNode>()
        var page = 0
        do {
            val rows = data("/api/v1/place/markets/search?q=&lang=$lang&page=${page++}&size=50").path("markets").toList()
            rows.forEach { result[it.path("contentId").asText()] = it }
        } while (rows.size == 50)
        return result
    }

    private fun data(path: String): JsonNode {
        val body = requireNotNull(client.get().uri(path).retrieve().bodyToMono(JsonNode::class.java)
            .timeout(Duration.ofSeconds(60)).block()) { "Empty place response: $path" }
        return requireNotNull(body.get("data")?.takeUnless { it.isNull }) { "Missing place data: $path" }
    }
}
