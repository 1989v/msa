package com.kgd.place.infrastructure.opensearch

import com.kgd.place.application.poi.port.PoiIndexPort
import com.kgd.place.domain.poi.model.PoiDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.json.JsonObject
import org.opensearch.client.json.JsonpDeserializer
import org.opensearch.client.opensearch.OpenSearchClient
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

    companion object {
        private const val INDEX_DEFINITION_RESOURCE = "/opensearch/poi-index.json"
    }

    override fun ensureIndex() {
        val exists = osClient.indices().exists { it.index(indexName) }.value()
        if (exists) {
            log.info { "poi 인덱스 이미 존재: $indexName" }
            return
        }
        val definition = loadIndexDefinition()
        val settings = definition.getJsonObject("settings").parseAs(IndexSettings._DESERIALIZER)
        val mappings = definition.getJsonObject("mappings").parseAs(TypeMapping._DESERIALIZER)
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
