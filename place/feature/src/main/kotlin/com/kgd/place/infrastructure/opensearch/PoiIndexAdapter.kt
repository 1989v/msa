package com.kgd.place.infrastructure.opensearch

import com.kgd.place.application.poi.port.PoiIndexPort
import com.kgd.place.domain.poi.model.PoiDocument
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.json.JsonpDeserializer
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.OpenSearchException
import org.opensearch.client.opensearch._types.mapping.TypeMapping
import org.opensearch.client.opensearch.core.bulk.BulkOperation
import org.opensearch.client.opensearch.indices.IndexSettings
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.StringReader

@Component
class PoiIndexAdapter(
    private val osClient: OpenSearchClient,
    @Value("\${place.poi.index:poi}") private val indexName: String,
) : PoiIndexPort {

    private val log = KotlinLogging.logger {}

    // 인덱스 정의 리소스 분해 전용 로컬 파서 (search IndexAliasManager 와 동일 패턴, ADR-0067).
    // Spring 빈을 주입받지 않는다 — 컨텍스트의 ObjectMapper 는 Jackson 3 타입이라
    // Jackson 2 타입 주입은 기동 실패를 부른다 (2026-08-12 place 크래시루프 원인).
    private val jsonSplitter = ObjectMapper()

    companion object {
        private const val INDEX_DEFINITION_RESOURCE = "/opensearch/poi-index.json"
    }

    override fun ensureIndex() {
        if (indexExists()) {
            log.info { "poi 인덱스 이미 존재: $indexName" }
            return
        }
        val definition = loadIndexDefinition()
        val settings = definition.required("settings").parseAs(IndexSettings._DESERIALIZER)
        val mappings = definition.required("mappings").parseAs(TypeMapping._DESERIALIZER)
        osClient.indices().create { req -> req.index(indexName).settings(settings).mappings(mappings) }
        log.info { "poi 인덱스 생성: $indexName" }
    }

    override fun index(doc: PoiDocument) {
        val indexDoc = PoiIndexDocument.fromDomain(doc)
        osClient.index { it.index(indexName).id(indexDoc.id).document(indexDoc) }
    }

    override fun bulkIndex(docs: List<PoiDocument>) {
        if (docs.isEmpty()) return
        val ops = docs.map { d ->
            val indexDoc = PoiIndexDocument.fromDomain(d)
            BulkOperation.of { op -> op.index { idx -> idx.index(indexName).id(indexDoc.id).document(indexDoc) } }
        }
        val response = osClient.bulk { b -> b.operations(ops) }
        val failed = response.items().count { it.error() != null }
        if (failed > 0) log.error { "poi bulk 색인 실패 $failed/${ops.size}건" }
    }

    /**
     * `indices().exists()` 는 인덱스가 없을 때 false 가 아니라 404 예외를 던진다.
     * 없음을 없음으로 읽지 않으면 정작 아래 create 에 도달하지 못해 인덱스가 영영 생기지 않는다.
     */
    private fun indexExists(): Boolean =
        try {
            osClient.indices().exists { it.index(indexName) }.value()
        } catch (e: OpenSearchException) {
            if (e.status() == 404) false else throw e
        }

    /**
     * 정의 파일은 Jackson 으로 읽는다 — JacksonJsonpMapper 의 jsonProvider 는
     * createReader(InputStream) 를 지원하지 않는다(createParser 만 구현). search 쪽 구현과 동일한 방식.
     */
    private fun loadIndexDefinition(): JsonNode {
        val stream = requireNotNull(javaClass.getResourceAsStream(INDEX_DEFINITION_RESOURCE)) {
            "Index definition resource not found: $INDEX_DEFINITION_RESOURCE"
        }
        return stream.use { jsonSplitter.readTree(it) }
    }

    private fun JsonNode.required(key: String): JsonNode =
        requireNotNull(get(key)) { "'$key' 누락 — $INDEX_DEFINITION_RESOURCE 정의 확인" }

    private fun <T> JsonNode.parseAs(deserializer: JsonpDeserializer<T>): T {
        val mapper = osClient._transport().jsonpMapper()
        return mapper.jsonProvider().createParser(StringReader(toString())).use { parser ->
            deserializer.deserialize(parser, mapper)
        }
    }
}
