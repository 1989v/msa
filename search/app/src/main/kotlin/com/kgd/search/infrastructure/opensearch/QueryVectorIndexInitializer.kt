package com.kgd.search.infrastructure.opensearch

import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.json.JsonpDeserializer
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.mapping.TypeMapping
import org.opensearch.client.opensearch.indices.CreateIndexRequest
import org.opensearch.client.opensearch.indices.IndexSettings
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.io.StringReader

/**
 * `query_vectors` 인덱스를 기동 시 만든다 (ADR-0090 §3.1). **멱등** — 이미 있으면 손대지 않는다.
 *
 * 이 인덱스는 재색인 대상이 아니라(alias swap 이 없다) 사전이 계속 쌓이는 곳이라, batch 가 아니라
 * 앱이 만든다. 매핑 JSON 이 계약의 원본이고 `dynamic: strict` 라 필드 오타는 색인 실패로 드러난다.
 *
 * **만들지 못해도 앱은 뜬다** — 사전이 없으면 벡터 레그가 꺼질 뿐 검색은 BM25 로 답한다.
 * 여기서 기동을 막으면 OpenSearch 가 늦게 뜬 날 검색 전체가 죽는다.
 */
@Component
class QueryVectorIndexInitializer(
    private val client: OpenSearchClient,
) {
    private val log = KotlinLogging.logger {}

    // opensearch-java 3.x 의 CreateIndexRequest.Builder 에는 withJson 이 없다 —
    // settings/mappings 를 각각 _DESERIALIZER 로 파싱해 typed builder 에 넣는다 (IndexAliasManager 와 같은 이유).
    private val jsonSplitter = ObjectMapper()

    @EventListener(ApplicationReadyEvent::class)
    fun createIfAbsent() {
        runCatching {
            if (client.indices().exists { it.index(QueryVectorAdapter.INDEX) }.value()) {
                log.info { "${QueryVectorAdapter.INDEX} 인덱스가 이미 있다" }
                return@runCatching
            }
            val definition = javaClass.getResourceAsStream(MAPPING_RESOURCE).use { stream ->
                requireNotNull(stream) { "$MAPPING_RESOURCE 를 못 찾았다" }
                jsonSplitter.readTree(stream)
            }
            client.indices().create(
                CreateIndexRequest.Builder()
                    .index(QueryVectorAdapter.INDEX)
                    .settings(definition.required("settings").parseAs(IndexSettings._DESERIALIZER))
                    .mappings(definition.required("mappings").parseAs(TypeMapping._DESERIALIZER))
                    .build(),
            )
            log.info { "${QueryVectorAdapter.INDEX} 인덱스를 만들었다" }
        }.onFailure {
            log.warn(it) { "${QueryVectorAdapter.INDEX} 인덱스를 만들지 못했다 — 사전 없이 BM25 로 답한다" }
        }
    }

    private fun JsonNode.required(key: String): JsonNode =
        requireNotNull(get(key)) { "'$key' 누락 — $MAPPING_RESOURCE 확인" }

    private fun <T> JsonNode.parseAs(deserializer: JsonpDeserializer<T>): T {
        val mapper = client._transport().jsonpMapper()
        return mapper.jsonProvider().createParser(StringReader(toString())).use { parser ->
            deserializer.deserialize(parser, mapper)
        }
    }

    companion object {
        const val MAPPING_RESOURCE = "/opensearch/query-vectors-index.json"
    }
}
