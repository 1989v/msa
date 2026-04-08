package com.kgd.search.infrastructure.elasticsearch

import co.elastic.clients.elasticsearch._types.query_dsl.FunctionBoostMode
import co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreMode
import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.client.elc.NativeQuery
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHitSupport
import org.springframework.stereotype.Component

@Component
class ProductSearchAdapter(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val rankingProperties: RankingProperties
) : ProductSearchPort {

    override fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
        val query = NativeQuery.builder()
            .withQuery { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m ->
                                m.match { mt ->
                                    mt.field("name").query(keyword)
                                }
                            }
                            b.filter { f ->
                                f.term { t ->
                                    t.field("status").value("ACTIVE")
                                }
                            }
                        }
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("popularityScore")
                                .factor(rankingProperties.popularityWeight)
                                .modifier(co.elastic.clients.elasticsearch._types.query_dsl.FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0)
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("ctr")
                                .factor(rankingProperties.ctrWeight)
                                .modifier(co.elastic.clients.elasticsearch._types.query_dsl.FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0)
                    }
                    fs.scoreMode(FunctionScoreMode.Sum)
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .withPageable(pageable)
            .build()

        val searchHits = elasticsearchOperations.search(query, ProductEsDocument::class.java)
        val searchPage = SearchHitSupport.searchPageFor(searchHits, pageable)
        @Suppress("UNCHECKED_CAST")
        val esPage = SearchHitSupport.unwrapSearchHits(searchPage) as Page<ProductEsDocument>
        return PageImpl(
            esPage.content.map { it.toDomain() },
            esPage.pageable,
            esPage.totalElements
        )
    }
}
