package com.kgd.search.infrastructure.opensearch

import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOptions
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

/**
 * ADR-0050 Phase 4 — RankingProperties 가 주어졌을 때 동일 로직으로 SearchRequest 를 빌드.
 * ADR-0055 — Spring Data `NativeQuery` 에서 opensearch-java `SearchRequest` 로 전환 (쿼리 의미 동일).
 *
 * 호출자:
 *  - ProductSearchAdapter (live, default RankingProperties)
 *  - SearchDebugController (variant 별 RankingProperties — A/B 비교)
 *
 * 본 단일 진입점으로 추출해 두면 ranking 함수 추가/변경 시 한 곳에서만 수정하면 된다.
 */
@Component
class RankingQueryBuilder {

    fun build(indexName: String, keyword: String, pageable: Pageable, props: RankingProperties): SearchRequest =
        SearchRequest.Builder()
            .index(indexName)
            .query { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m -> m.match { it.field("name").query(FieldValue.of(keyword)) } }
                            b.filter { f -> f.term { it.field("status").value(FieldValue.of("ACTIVE")) } }
                        }
                    }

                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("popularityScore")
                                .factor(props.popularityWeight.toFloat())
                                .modifier(FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0f)
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("ctr")
                                .factor(props.ctrWeight.toFloat())
                                .modifier(FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0f)
                    }
                    if (props.cvrWeight > 0.0) {
                        fs.functions { fn ->
                            fn.fieldValueFactor { fvf ->
                                fvf.field("cvr")
                                    .factor(props.cvrWeight.toFloat())
                                    .modifier(FieldValueFactorModifier.Log1p)
                                    .missing(0.0)
                            }
                            fn.weight(1.0f)
                        }
                    }
                    if (props.gmv7dWeight > 0.0) {
                        fs.functions { fn ->
                            fn.fieldValueFactor { fvf ->
                                fvf.field("gmv7d")
                                    .factor(props.gmv7dWeight.toFloat())
                                    .modifier(FieldValueFactorModifier.Log1p)
                                    .missing(0.0)
                            }
                            fn.weight(1.0f)
                        }
                    }
                    if (props.gmv30dWeight > 0.0) {
                        fs.functions { fn ->
                            fn.fieldValueFactor { fvf ->
                                fvf.field("gmv30d")
                                    .factor(props.gmv30dWeight.toFloat())
                                    .modifier(FieldValueFactorModifier.Log1p)
                                    .missing(0.0)
                            }
                            fn.weight(1.0f)
                        }
                    }
                    if (props.freshness.weight > 0.0) {
                        val freshness = props.freshness
                        fs.functions { fn ->
                            fn.gauss { g ->
                                g.field("createdAt")
                                    .placement { p ->
                                        p.origin(JsonData.of(freshness.origin))
                                            .scale(JsonData.of(freshness.scale))
                                            .offset(JsonData.of(freshness.offset))
                                            .decay(freshness.decay)
                                    }
                            }
                            fn.weight(freshness.weight.toFloat())
                        }
                    }

                    fs.scoreMode(FunctionScoreMode.Sum)
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .sort(
                SortOptions.of { s -> s.score { it.order(SortOrder.Desc) } },
                SortOptions.of { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } }
            )
            .from(pageable.offset.toInt())
            .size(pageable.pageSize)
            .build()
}
