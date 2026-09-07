package com.kgd.search.infrastructure.client

import com.kgd.search.domain.queryvector.port.QueryEncoderPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * 질의 인코더 사이드카 클라이언트 (ADR-0090 개정 2026-09-08).
 *
 * **실패를 삼켜 null 로 돌린다.** 인코더가 죽어도 검색은 BM25 로 답해야 한다 —
 * 여기서 예외를 던지면 사이드카 장애가 검색 장애가 된다.
 *
 * 타임아웃을 짧게 잡는 이유: 인코딩 p50 이 150ms 라 그보다 크게 늦으면 이미 예산을 넘긴 것이고,
 * 기다리는 것보다 BM25 로 답하는 편이 사용자에게 낫다.
 */
@Component
class QueryEncoderAdapter(
    private val properties: QueryEncoderProperties,
) : QueryEncoderPort {

    private val log = KotlinLogging.logger {}

    private val client: RestClient = RestClient.builder()
        .baseUrl(properties.baseUrl)
        .requestFactory(
            org.springframework.http.client.SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofMillis(properties.connectTimeoutMs))
                setReadTimeout(Duration.ofMillis(properties.readTimeoutMs))
            },
        )
        .build()

    override fun encode(normalized: String): List<Float>? = runCatching {
        val body = client.post().uri("/encode")
            .body(mapOf("query" to normalized))
            .retrieve()
            .body(EncodeResponse::class.java)
        body?.vector?.takeIf { it.isNotEmpty() }
    }.getOrElse {
        log.warn { "질의 인코딩 실패 (BM25 로 답한다): ${it.message}" }
        null
    }

    override fun modelRef(): String? = runCatching {
        client.get().uri("/model").retrieve().body(ModelResponse::class.java)?.modelRef
    }.getOrElse {
        log.warn { "인코더 스탬프 조회 실패: ${it.message}" }
        null
    }

    data class EncodeResponse(val vector: List<Float> = emptyList(), val dim: Int = 0)
    data class ModelResponse(val modelRef: String = "")
}
