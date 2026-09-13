package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.unified.port.UnifiedSearchPort
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.stereotype.Component

/**
 * `unified` 인덱스 검색 — BM25 만. 코퍼스가 수백 건이라 정확 일치가 대부분이고, 벡터는 이득을 재기 전엔 싣지 않는다.
 * 인기도는 `ln1p` 로 눌러 곱한다 — 같은 제목 점수면 많이 본 것이 앞선다.
 */
@Component
class UnifiedSearchAdapter(
    private val client: OpenSearchClient,
) : UnifiedSearchPort {

    override fun search(query: UnifiedSearchPort.Query): UnifiedSearchPort.Page {
        val keyword = query.keyword?.takeIf { it.isNotBlank() }
        val matched = Query.of { q ->
            q.bool { b ->
                if (keyword != null) {
                    b.must { m -> m.multiMatch { mm -> mm.query(keyword).fields(KEYWORD_FIELDS) } }
                } else {
                    b.must { m -> m.matchAll { it } }
                }
                b.filter { f -> f.term { t -> t.field("type").value(FieldValue.of(query.type)) } }
                query.facets.forEach { (field, value) ->
                    b.filter { f -> f.term { t -> t.field("facets.$field").value(FieldValue.of(value)) } }
                }
                b
            }
        }
        val request = SearchRequest.Builder()
            .index(INDEX)
            .query(withPopularity(matched))
            .source { s -> s.filter { f -> f.excludes(BODY_FIELD) } }
            .size(query.size)
            .apply { if (keyword == null) sort { s -> s.field { f -> f.field("popularity").order(SortOrder.Desc) } } }
            .build()
        val response = client.search(request, UnifiedSearchDocument::class.java)
        val hits = response.hits().hits().mapNotNull { hit ->
            hit.source()?.let { d ->
                UnifiedSearchPort.Hit(
                    id = d.id, type = d.type, sourceId = d.sourceId, slug = d.slug, title = d.title,
                    summary = d.summary, category = d.category, thumbnailUrl = d.thumbnailUrl,
                    facets = d.facets, score = hit.score() ?: 0.0,
                )
            }
        }
        return UnifiedSearchPort.Page(hits = hits, total = response.hits().total()?.value() ?: 0L)
    }

    private fun withPopularity(matched: Query): Query = Query.of { q ->
        q.functionScore { fs ->
            fs.query(matched)
            fs.functions { fn ->
                fn.fieldValueFactor { fvf ->
                    fvf.field("popularity").factor(1.0f).modifier(FieldValueFactorModifier.Ln1p).missing(0.0)
                }
            }
            fs.scoreMode(FunctionScoreMode.Multiply)
            // 인기도 0 이면 ln1p(0)=0 이라 곱하면 점수가 사라진다 — 더한다
            fs.boostMode(FunctionBoostMode.Sum)
        }
    }

    companion object {
        const val INDEX = "unified"
        private const val BODY_FIELD = "body"

        /** 제목이 앞, 영문 필드도 같이 — 국문 문서 하나에 영문 제목·요약을 실었다 */
        private val KEYWORD_FIELDS = listOf(
            "title^3", "title.en^3", "titleEn^3", "summary", "summary.en", "body", "body.en", "tags^2",
        )
    }
}
