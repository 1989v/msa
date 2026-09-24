package com.kgd.ads.support

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.io.ByteArrayOutputStream
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpHeaders
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.UUID

/**
 * 광고주·어드민 API 를 실제 HTTP 로 부른다 — 헤더 바인딩·multipart·JSON 모양까지 운영 경로 그대로.
 * 신원 헤더는 게이트웨이가 넣는 것과 같은 이름(`X-User-Id`·`X-User-Roles`)이다.
 */
class AdsApiClient(private val port: Int) {
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
    val json: JsonMapper = JsonMapper.builder().build()

    class Response(val status: Int, val bytes: ByteArray, val headers: HttpHeaders, private val json: JsonMapper) {
        val body: JsonNode by lazy { json.readTree(bytes) }
        val data: JsonNode get() = body["data"]
    }

    /** 신원. [admin] 이면 `ROLE_ADMIN` 을 싣는다. */
    data class As(val memberId: Long?, val admin: Boolean = false)

    class FilePart(val filename: String, val contentType: String, val bytes: ByteArray)

    fun get(path: String, who: As?): Response = send("GET", path, who, null, null)
    fun post(path: String, who: As?, body: Any? = null): Response = send("POST", path, who, body?.let(json::writeValueAsString), JSON)
    fun put(path: String, who: As?, body: Any?): Response = send("PUT", path, who, body?.let(json::writeValueAsString), JSON)
    fun patch(path: String, who: As?, body: Any?): Response = send("PATCH", path, who, body?.let(json::writeValueAsString), JSON)
    fun delete(path: String, who: As?): Response = send("DELETE", path, who, null, null)

    /** JSON 문자열을 그대로 보낸다 — 요청 모델에 없는 필드를 실어 보는 용도. */
    fun postRaw(path: String, who: As?, rawJson: String): Response = send("POST", path, who, rawJson, JSON)

    fun multipart(method: String, path: String, who: As?, fields: Map<String, String>, file: FilePart?): Response {
        val boundary = "ads-${UUID.randomUUID()}"
        val out = ByteArrayOutputStream()
        fun line(s: String) = out.write("$s\r\n".toByteArray())
        fields.forEach { (name, value) ->
            line("--$boundary")
            line("Content-Disposition: form-data; name=\"$name\"")
            line("Content-Type: text/plain; charset=UTF-8")
            line("")
            line(value)
        }
        if (file != null) {
            line("--$boundary")
            line("Content-Disposition: form-data; name=\"image\"; filename=\"${file.filename}\"")
            line("Content-Type: ${file.contentType}")
            line("")
            out.write(file.bytes)
            line("")
        }
        line("--$boundary--")
        return sendBytes(method, path, who, out.toByteArray(), "multipart/form-data; boundary=$boundary")
    }

    private fun send(method: String, path: String, who: As?, body: String?, contentType: String?): Response =
        sendBytes(method, path, who, body?.toByteArray(), contentType)

    private fun sendBytes(method: String, path: String, who: As?, body: ByteArray?, contentType: String?): Response {
        val request = HttpRequest.newBuilder(URI.create("http://localhost:$port$path"))
            .timeout(Duration.ofSeconds(10))
            .apply { contentType?.let { header("Content-Type", it) } }
            .apply { who?.memberId?.let { header("X-User-Id", it.toString()) } }
            .apply { if (who?.admin == true) header("X-User-Roles", "ROLE_USER,ROLE_ADMIN") }
            .method(method, body?.let { HttpRequest.BodyPublishers.ofByteArray(it) } ?: HttpRequest.BodyPublishers.noBody())
            .build()
        val response = http.send(request, HttpResponse.BodyHandlers.ofByteArray())
        return Response(response.statusCode(), response.body(), response.headers(), json)
    }

    private companion object {
        const val JSON = "application/json"
    }
}

/** JSON 배열의 원소들. */
fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }
