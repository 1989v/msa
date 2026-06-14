package com.kgd.search.infrastructure.eval

import com.kgd.search.domain.eval.RankingExecutionPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.stereotype.Component

/**
 * ADR-0050 Phase 4 — baseline variant 평가 실행기.
 * ADR-0055 — Spring Data `NativeQuery` 에서 opensearch-java `SearchRequest` 로 전환 (쿼리 의미 동일).
 *
 * 단순 match 쿼리만 발사 (function_score / rerank / diversity 없음). 이는 *baseline NDCG*
 * 측정용으로, 운영 ranking 의 효과를 절대 기준이 아닌 **변화량** 으로 비교하기 위함.
 *
 * 다른 variant (function_score, rerank 포함) 측정은 Phase 4 UI 의 SearchDebugController
 * 또는 별도 어댑터 도입 시 확장.
 */
@Component
class OsRankingExecutor(
    private val osClient: OpenSearchClient
) : RankingExecutionPort {

    private val log = KotlinLogging.logger {}

    override fun searchTopK(query: String, k: Int): List<String> {
        val request = SearchRequest.Builder()
            .index("products")
            .query { q ->
                q.bool { b ->
                    b.must { m -> m.match { it.field("name").query(FieldValue.of(query)) } }
                    b.filter { f -> f.term { it.field("status").value(FieldValue.of("ACTIVE")) } }
                }
            }
            .size(k)
            .build()

        return runCatching {
            osClient.search(request, Map::class.java)
                .hits().hits()
                .mapNotNull { it.id() }
        }.onFailure { log.warn { "OpenSearch search failed for query='$query': ${it.message}" } }
            .getOrDefault(emptyList())
    }
}
