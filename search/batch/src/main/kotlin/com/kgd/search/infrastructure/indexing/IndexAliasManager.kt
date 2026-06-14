package com.kgd.search.infrastructure.indexing

import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.json.JsonObject
import org.opensearch.client.json.JsonpDeserializer
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.mapping.TypeMapping
import org.opensearch.client.opensearch.indices.IndexSettings
import org.springframework.stereotype.Component
import java.io.StringReader
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class IndexAliasManager(private val osClient: OpenSearchClient) {

    private val log = KotlinLogging.logger {}
    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    companion object {
        /** settings/mappings 의 SSOT (ADR-0055) — nori 분석기 + 필드 매핑 전체. */
        private const val INDEX_DEFINITION_RESOURCE = "/opensearch/products-index.json"
    }

    /** 새 타임스탬프 색인명 생성: products_20260309120000 */
    fun createTimestampedIndexName(alias: String): String =
        "${alias}_${LocalDateTime.now().format(timestampFormatter)}"

    /**
     * OpenSearch에 새 색인 생성 (nori 분석기 + 기본 매핑).
     *
     * ADR-0055 — 정의는 `opensearch/products-index.json` 단일 JSON 리소스.
     * opensearch-java 3.x 의 `CreateIndexRequest.Builder` 에는 withJson 이 없어
     * settings/mappings 를 각각 `_DESERIALIZER` 로 파싱해 typed builder 에 주입한다.
     */
    fun createIndex(indexName: String) {
        val definition = loadIndexDefinition()
        val settings = definition.getJsonObject("settings").parseAs(IndexSettings._DESERIALIZER)
        val mappings = definition.getJsonObject("mappings").parseAs(TypeMapping._DESERIALIZER)

        osClient.indices().create { req ->
            req.index(indexName)
               .settings(settings)
               .mappings(mappings)
        }
        log.info { "Created index: $indexName" }
    }

    /**
     * alias를 newIndexName으로 atomic 교체하고, 이름 prefix 로 전체 timestamped 인덱스를 스캔해
     * 최신 maxRetention 개를 제외한 옛 인덱스를 삭제.
     */
    fun updateAliasAndCleanup(alias: String, newIndexName: String, maxRetention: Int = 2) {
        val aliasedIndices = getIndicesForAlias(alias)

        osClient.indices().updateAliases { req ->
            // opensearch-java: actions(Function<Builder, ObjectBuilder<Action>>) 는 단건 액션 빌더.
            // 여러 액션을 등록하려면 매 액션마다 .actions{} 를 별도 호출해야 함.
            aliasedIndices.forEach { oldIndex ->
                req.actions { a -> a.remove { r -> r.index(oldIndex).alias(alias) } }
            }
            req.actions { a -> a.add { ad -> ad.index(newIndexName).alias(alias) } }
            req
        }
        log.info { "Alias '$alias' → '$newIndexName' (removed ${aliasedIndices.size} old)" }

        // 이름 prefix 기반 전체 스캔 — alias 가 빠진 옛 인덱스도 retention 정리
        val allTimestamped = listIndicesByPrefix("${alias}_")
        allTimestamped
            .sortedDescending()
            .drop(maxRetention)
            .forEach { oldIndex ->
                osClient.indices().delete { d -> d.index(oldIndex) }
                log.info { "Deleted old index: $oldIndex" }
            }
    }

    private fun getIndicesForAlias(alias: String): List<String> =
        runCatching {
            osClient.indices().getAlias { it.name(alias) }.result().keys.toList()
        }.getOrElse { emptyList() }

    private fun listIndicesByPrefix(prefix: String): List<String> =
        runCatching {
            osClient.indices().get { it.index("${prefix}*") }.result().keys.toList()
        }.getOrElse { emptyList() }

    private fun loadIndexDefinition(): JsonObject {
        val stream = requireNotNull(javaClass.getResourceAsStream(INDEX_DEFINITION_RESOURCE)) {
            "Index definition resource not found: $INDEX_DEFINITION_RESOURCE"
        }
        return stream.use { s ->
            osClient._transport().jsonpMapper().jsonProvider().createReader(s).readObject()
        }
    }

    private fun <T> JsonObject.parseAs(deserializer: JsonpDeserializer<T>): T {
        val mapper = osClient._transport().jsonpMapper()
        return mapper.jsonProvider().createParser(StringReader(toString())).use { parser ->
            deserializer.deserialize(parser, mapper)
        }
    }
}
