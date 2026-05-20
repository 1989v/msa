package com.kgd.search.infrastructure.elasticsearch

import co.elastic.clients.elasticsearch._types.SortOptions
import co.elastic.clients.elasticsearch._types.SortOrder
import co.elastic.clients.elasticsearch._types.Time
import co.elastic.clients.elasticsearch._types.query_dsl.FieldValueFactorModifier
import co.elastic.clients.elasticsearch._types.query_dsl.FunctionBoostMode
import co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreMode
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.client.elc.NativeQuery
import org.springframework.stereotype.Component

/**
 * ADR-0050 Phase 4 — RankingProperties 가 주어졌을 때 동일 로직으로 NativeQuery 를 빌드.
 *
 * 호출자:
 *  - ProductSearchAdapter (live, default RankingProperties)
 *  - SearchDebugController (variant 별 RankingProperties — A/B 비교)
 *
 * 본 단일 진입점으로 추출해 두면 ranking 함수 추가/변경 시 한 곳에서만 수정하면 된다.
 */
@Component
class RankingQueryBuilder {

    fun build(keyword: String, pageable: Pageable, props: RankingProperties): NativeQuery =
        NativeQuery.builder()
            .withQuery { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m -> m.match { it.field("name").query(keyword) } }
                            b.filter { f -> f.term { it.field("status").value("ACTIVE") } }
                        }
                    }

                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("popularityScore")
                                .factor(props.popularityWeight)
                                .modifier(FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0)
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("ctr")
                                .factor(props.ctrWeight)
                                .modifier(FieldValueFactorModifier.Log1p)
                                .missing(0.0)
                        }
                        fn.weight(1.0)
                    }
                    if (props.cvrWeight > 0.0) {
                        fs.functions { fn ->
                            fn.fieldValueFactor { fvf ->
                                fvf.field("cvr")
                                    .factor(props.cvrWeight)
                                    .modifier(FieldValueFactorModifier.Log1p)
                                    .missing(0.0)
                            }
                            fn.weight(1.0)
                        }
                    }
                    if (props.gmv7dWeight > 0.0) {
                        fs.functions { fn ->
                            fn.fieldValueFactor { fvf ->
                                fvf.field("gmv7d")
                                    .factor(props.gmv7dWeight)
                                    .modifier(FieldValueFactorModifier.Log1p)
                                    .missing(0.0)
                            }
                            fn.weight(1.0)
                        }
                    }
                    if (props.gmv30dWeight > 0.0) {
                        fs.functions { fn ->
                            fn.fieldValueFactor { fvf ->
                                fvf.field("gmv30d")
                                    .factor(props.gmv30dWeight)
                                    .modifier(FieldValueFactorModifier.Log1p)
                                    .missing(0.0)
                            }
                            fn.weight(1.0)
                        }
                    }
                    if (props.freshness.weight > 0.0) {
                        val freshness = props.freshness
                        fs.functions { fn ->
                            fn.gauss { g ->
                                g.date { d ->
                                    d.field("createdAt")
                                        .placement { p ->
                                            p.origin(freshness.origin)
                                                .scale(Time.of { it.time(freshness.scale) })
                                                .offset(Time.of { it.time(freshness.offset) })
                                                .decay(freshness.decay)
                                        }
                                }
                            }
                            fn.weight(freshness.weight)
                        }
                    }

                    fs.scoreMode(FunctionScoreMode.Sum)
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .withSort(
                SortOptions.of { s -> s.score { it.order(SortOrder.Desc) } },
                SortOptions.of { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } }
            )
            .withPageable(pageable)
            .build()
}
