package com.kgd.search.infrastructure.eval

import com.kgd.search.domain.eval.RankingExecutionPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.elasticsearch.client.elc.NativeQuery
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHit
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.stereotype.Component

/**
 * ADR-0050 Phase 4 — baseline variant 평가 실행기.
 *
 * 단순 match 쿼리만 발사 (function_score / rerank / diversity 없음). 이는 *baseline NDCG*
 * 측정용으로, 운영 ranking 의 효과를 절대 기준이 아닌 **변화량** 으로 비교하기 위함.
 *
 * 다른 variant (function_score, rerank 포함) 측정은 Phase 4 UI 의 SearchDebugController
 * 또는 별도 어댑터 도입 시 확장.
 */
@Component
class EsRankingExecutor(
    private val elasticsearchOperations: ElasticsearchOperations
) : RankingExecutionPort {

    private val log = KotlinLogging.logger {}

    override fun searchTopK(query: String, k: Int): List<String> {
        val nq = NativeQuery.builder()
            .withQuery { q ->
                q.bool { b ->
                    b.must { m -> m.match { it.field("name").query(query) } }
                    b.filter { f -> f.term { it.field("status").value("ACTIVE") } }
                }
            }
            .withPageable(org.springframework.data.domain.PageRequest.of(0, k))
            .build()

        return runCatching {
            elasticsearchOperations.search(nq, Map::class.java, IndexCoordinates.of("products"))
                .searchHits
                .mapNotNull { hit: SearchHit<Map<*, *>> -> hit.id }
        }.onFailure { log.warn { "ES search failed for query='$query': ${it.message}" } }
            .getOrDefault(emptyList())
    }
}
