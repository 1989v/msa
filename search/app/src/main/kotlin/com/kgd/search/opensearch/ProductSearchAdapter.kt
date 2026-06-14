package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
class ProductSearchAdapter(
    private val client: OpenSearchClient,
    private val rankingProperties: RankingProperties,
    private val rankingVariants: RankingVariantsProperties,
    private val queryBuilder: RankingQueryBuilder
) : ProductSearchPort {

    companion object {
        const val INDEX = "products"
    }

    override fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
        val response = executeSearch(keyword, pageable, rankingProperties)
        val content = response.hits().hits().mapNotNull { it.source()?.toDomain() }
        return PageImpl(content, pageable, response.hits().total()?.value() ?: 0L)
    }

    override fun searchScored(
        keyword: String,
        pageable: Pageable,
        rankingVariant: String?,
    ): Page<ScoredProductDocument> {
        // 미정의 variant 키 (control 등) 는 기본 ranking 으로 fallback
        val props = rankingVariant?.let { rankingVariants.variants[it] } ?: rankingProperties
        val response = executeSearch(keyword, pageable, props)
        val content = response.hits().hits().mapNotNull { hit ->
            hit.source()?.let { ScoredProductDocument(it.toDomain(), hit.score() ?: 0.0) }
        }
        return PageImpl(content, pageable, response.hits().total()?.value() ?: 0L)
    }

    /**
     * 자동완성 — `match_bool_prefix` (마지막 term 만 prefix 매칭, 앞 term 들은 일반 매칭)
     * + popularityScore 부스트. nori 분석 기반이라 별도 매핑 변경 없이 동작한다.
     */
    override fun suggest(prefix: String, size: Int): List<ProductDocument> {
        val request = SearchRequest.Builder()
            .index(INDEX)
            .query { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m -> m.matchBoolPrefix { it.field("name").query(prefix) } }
                            b.filter { f -> f.term { it.field("status").value(FieldValue.of("ACTIVE")) } }
                        }
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("popularityScore")
                                .factor(1.0f)
                                .modifier(FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0f)
                    }
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .size(size)
            .build()
        return client.search(request, ProductSearchDocument::class.java)
            .hits().hits().mapNotNull { it.source()?.toDomain() }
    }

    private fun executeSearch(
        keyword: String,
        pageable: Pageable,
        props: RankingProperties,
    ): SearchResponse<ProductSearchDocument> {
        val request = queryBuilder.build(INDEX, keyword, pageable, props)
        return client.search(request, ProductSearchDocument::class.java)
    }
}
