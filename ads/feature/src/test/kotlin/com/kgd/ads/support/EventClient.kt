package com.kgd.ads.support

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/** 이벤트·클릭·에셋 API 를 실제 HTTP 로 부른다. 리다이렉트는 따라가지 않는다 — 302 의 Location 을 본다. */
class EventClient(private val port: Int) {
    private val http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()
    private val json = JsonMapper.builder().build()

    data class EventsResponse(val status: Int, val body: JsonNode) {
        val accepted: Int get() = body["data"]["accepted"].asInt()

        fun rejected(reason: String): Int = body["data"]["rejected"][reason]?.asInt() ?: 0
    }

    fun events(
        tokens: List<String>,
        visitorId: String? = "vid-human-1",
        fills: List<Pair<String, String>> = emptyList(),
        contentType: String = "application/json",
        userAgent: String = DecisionClient.HUMAN_UA,
    ): EventsResponse {
        val payload = json.writeValueAsString(
            mapOf(
                "tokens" to tokens,
                "visitorId" to "identity-visitor",
                "sessionId" to "identity-session",
                "fills" to fills.map { (key, source) -> mapOf("placementKey" to key, "source" to source) },
            ),
        )
        val request = HttpRequest.newBuilder(URI.create("http://localhost:$port/api/v1/ads/events"))
            .timeout(Duration.ofSeconds(5))
            .header("Content-Type", contentType)
            .header("User-Agent", userAgent)
            .apply { visitorId?.let { header("X-Visitor-Id", it) } }
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build()
        val response = http.send(request, HttpResponse.BodyHandlers.ofString())
        return EventsResponse(response.statusCode(), json.readTree(response.body()))
    }

    fun click(clickToken: String, visitorId: String? = "vid-human-1", userAgent: String = DecisionClient.HUMAN_UA): HttpResponse<String> =
        http.send(
            HttpRequest.newBuilder(URI.create("http://localhost:$port/api/v1/ads/click/$clickToken"))
                .timeout(Duration.ofSeconds(5))
                .header("User-Agent", userAgent)
                .apply { visitorId?.let { header("X-Visitor-Id", it) } }
                .GET()
                .build(),
            HttpResponse.BodyHandlers.ofString(),
        )

    fun asset(hash: String): HttpResponse<ByteArray> =
        http.send(
            HttpRequest.newBuilder(URI.create("http://localhost:$port/api/v1/ads/assets/$hash")).timeout(Duration.ofSeconds(5)).GET().build(),
            HttpResponse.BodyHandlers.ofByteArray(),
        )
}
