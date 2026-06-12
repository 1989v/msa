package com.kgd.search.infrastructure.elasticsearch

import co.elastic.clients.elasticsearch._types.query_dsl.FieldValueFactorModifier
import co.elastic.clients.elasticsearch._types.query_dsl.FunctionBoostMode
import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.client.elc.NativeQuery
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHits
import org.springframework.stereotype.Component

@Component
class ProductSearchAdapter(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val rankingProperties: RankingProperties,
    private val rankingVariants: RankingVariantsProperties,
    private val queryBuilder: RankingQueryBuilder
) : ProductSearchPort {

    override fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
        val hits = executeSearch(keyword, pageable, rankingProperties)
        val content = hits.searchHits.map { it.content.toDomain() }
        return PageImpl(content, pageable, hits.totalHits)
    }

    override fun searchScored(
        keyword: String,
        pageable: Pageable,
        rankingVariant: String?,
    ): Page<ScoredProductDocument> {
        // 미정의 variant 키 (control 등) 는 기본 ranking 으로 fallback
        val props = rankingVariant?.let { rankingVariants.variants[it] } ?: rankingProperties
        val hits = executeSearch(keyword, pageable, props)
        val content = hits.searchHits.map { ScoredProductDocument(it.content.toDomain(), it.score.toDouble()) }
        return PageImpl(content, pageable, hits.totalHits)
    }

    /**
     * 자동완성 — `match_bool_prefix` (마지막 term 만 prefix 매칭, 앞 term 들은 일반 매칭)
     * + popularityScore 부스트. nori 분석 기반이라 별도 매핑 변경 없이 동작한다.
     */
    override fun suggest(prefix: String, size: Int): List<ProductDocument> {
        val query = NativeQuery.builder()
            .withQuery { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m -> m.matchBoolPrefix { it.field("name").query(prefix) } }
                            b.filter { f -> f.term { it.field("status").value("ACTIVE") } }
                        }
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("popularityScore")
                                .factor(1.0)
                                .modifier(FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0)
                    }
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .withPageable(PageRequest.of(0, size))
            .build()
        return elasticsearchOperations.search(query, ProductEsDocument::class.java)
            .searchHits.map { it.content.toDomain() }
    }

    private fun executeSearch(
        keyword: String,
        pageable: Pageable,
        props: RankingProperties,
    ): SearchHits<ProductEsDocument> {
        val query = queryBuilder.build(keyword, pageable, props)
        return elasticsearchOperations.search(query, ProductEsDocument::class.java)
    }
}
