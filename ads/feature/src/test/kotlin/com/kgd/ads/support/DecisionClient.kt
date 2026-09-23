package com.kgd.ads.support

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/** 실제 HTTP 로 결정 API 를 부른다 — 헤더 바인딩·JSON 모양까지 운영 경로 그대로. */
class DecisionClient(private val port: Int) {
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
    private val json = JsonMapper.builder().build()

    data class Response(val status: Int, val body: JsonNode, val elapsed: Duration) {
        fun placement(key: String): JsonNode =
            body["data"]["placements"].first { it["placementKey"].asString() == key }
    }

    fun decide(
        placements: List<String>,
        host: String = AdsFixtures.BLOG_HOST,
        contextKey: String? = null,
        visitorId: String? = "vid-human-1",
        userId: Long? = null,
        userAgent: String = HUMAN_UA,
    ): Response {
        val payload = json.writeValueAsString(mapOf("placements" to placements, "host" to host, "contextKey" to contextKey))
        val request = HttpRequest.newBuilder(URI.create("http://localhost:$port/api/v1/ads/decisions"))
            .timeout(Duration.ofSeconds(5))
            .header("Content-Type", "application/json")
            .header("User-Agent", userAgent)
            .apply { visitorId?.let { header("X-Visitor-Id", it) } }
            .apply { userId?.let { header("X-User-Id", it.toString()) } }
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build()
        val started = System.nanoTime()
        val response = http.send(request, HttpResponse.BodyHandlers.ofString())
        val elapsed = Duration.ofNanos(System.nanoTime() - started)
        return Response(response.statusCode(), json.readTree(response.body()), elapsed)
    }

    companion object {
        const val HUMAN_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
        const val CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    }
}
