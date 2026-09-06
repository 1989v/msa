package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.embedding.VectorCodec
import com.kgd.search.domain.queryvector.model.QueryVector
import com.kgd.search.domain.queryvector.port.QueryVectorPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.opensearch.core.BulkRequest
import org.opensearch.client.opensearch.core.bulk.BulkOperation
import org.opensearch.client.opensearch.core.bulk.IndexOperation
import org.springframework.stereotype.Component

/**
 * 질의 사전 저장소 (ADR-0090 §3). **검색하지 않는다 — id 로만 읽는다.**
 * 그래서 `vector` 는 `binary`(base64) 이고, 이 인덱스는 k-NN 대상이 아니다.
 */
@Component
class QueryVectorAdapter(
    private val client: OpenSearchClient,
) : QueryVectorPort {

    private val log = KotlinLogging.logger {}

    override fun find(id: String): QueryVector? {
        val response = client.get({ it.index(INDEX).id(id) }, QueryVectorDocument::class.java)
        if (!response.found()) return null
        return response.source()?.toDomain()
    }

    override fun upsertAll(vectors: List<QueryVector>): Int {
        if (vectors.isEmpty()) return 0
        val operations = vectors.map { vector ->
            BulkOperation.Builder().index(
                IndexOperation.Builder<QueryVectorDocument>()
                    .index(INDEX)
                    .id(vector.id)
                    .document(QueryVectorDocument.from(vector))
                    .build(),
            ).build()
        }
        val response = client.bulk(BulkRequest.Builder().operations(operations).refresh(REFRESH_POLICY).build())
        val failed = response.items().count { it.error() != null }
        if (failed > 0) {
            // dynamic: strict 라 필드를 잘못 보내면 조용히 들어가는 대신 여기서 잡힌다.
            response.items().firstOrNull { it.error() != null }?.let {
                log.error { "질의 사전 적재 실패 ${failed}건 — 첫 오류: ${it.error()?.reason()}" }
            }
        }
        return vectors.size - failed
    }

    override fun count(modelRef: String): Long =
        client.count { req ->
            req.index(INDEX).query(
                Query.Builder().term { t -> t.field("modelRef").value(FieldValue.of(modelRef)) }.build(),
            )
        }.count()

    companion object {
        const val INDEX = "query_vectors"

        /**
         * 도구가 넣자마자 도구가 status 로 확인하고, 질의 경로도 바로 적중해야 한다.
         * 항목 수가 만 단위라 refresh 비용이 문제되지 않는다.
         */
        private val REFRESH_POLICY = org.opensearch.client.opensearch._types.Refresh.True
    }
}
