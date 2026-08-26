package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.debug.port.SearchDebugPort
import com.kgd.search.application.debug.usecase.DebugSearchUseCase
import com.kgd.search.application.ranking.config.BanditProperties
import com.kgd.search.application.ranking.config.DiversityProperties
import com.kgd.search.application.ranking.service.MultiScopeBanditBlender
import com.kgd.search.application.ranking.service.SellerDiversityReranker
import com.kgd.search.application.ranking.service.ThompsonReranker
import com.kgd.search.domain.product.model.ProductDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOptions
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreQuery
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

/**
 * 검색 디버그의 실제 조회 (ADR-0050 Phase 4 UI). 랭킹 질의 조립·리랭킹·클러스터 호출을 모두 여기서 한다.
 */
@Component
class SearchDebugAdapter(
    private val rankingProperties: RankingProperties,
    private val rankingVariants: RankingVariantsProperties,
    private val banditProperties: BanditProperties,
    private val diversityProperties: DiversityProperties,
    private val thompsonReranker: ThompsonReranker,
    private val sellerDiversityReranker: SellerDiversityReranker,
    private val blender: MultiScopeBanditBlender,
    private val queryBuilder: RankingQueryBuilder,
    private val client: OpenSearchClient,
) : SearchDebugPort {
    private val log = KotlinLogging.logger {}

    override fun debug(query: String, variant: String, topK: Int): DebugSearchUseCase.DebugResult {
        val pageable = PageRequest.of(0, topK)
        // variant 분기: "live" 또는 매핑 없는 이름은 default RankingProperties.
        val effectiveProps = if (variant == "live") rankingProperties
            else rankingVariants.variants[variant] ?: rankingProperties

        val response = client.search(
            queryBuilder.build("products", query, pageable, effectiveProps),
            ProductSearchDocument::class.java,
        )
        val originalDocs = response.hits().hits()
            .mapNotNull { hit -> hit.source()?.let { it.toDomain() to (hit.score() ?: 0.0) } }

        val afterThompson = thompsonReranker.rerank(originalDocs)
        val afterDiversity = sellerDiversityReranker.rerank(afterThompson)

        val banditSamples = blender.blend(originalDocs.map { it.first })

        val results = afterDiversity.mapIndexed { idx, (doc, finalScore) ->
            val esScore = originalDocs.firstOrNull { it.first.id == doc.id }?.second ?: 0.0
            scoredItem(
                rank = idx,
                doc = doc,
                esScore = esScore,
                finalScore = finalScore,
                weights = weightSnapshot(effectiveProps),
                banditSample = banditSamples[doc.id],
            )
        }

        return DebugSearchUseCase.DebugResult(
            variant = variant,
            query = query,
            totalElements = response.hits().total()?.value() ?: 0L,
            results = results,
            config = DebugSearchUseCase.ConfigSnapshot(
                ranking = rankingSnapshot(effectiveProps),
                bandit = DebugSearchUseCase.BanditSnapshot(
                    enabled = banditProperties.enabled,
                    topN = banditProperties.topN,
                    hybridWeight = banditProperties.hybridWeight,
                    scopes = banditProperties.effectiveScopes().map { it.name },
                ),
                diversity = DebugSearchUseCase.DiversitySnapshot(
                    enabled = diversityProperties.enabled,
                    maxPerSeller = diversityProperties.maxPerSeller,
                    topK = diversityProperties.topK,
                ),
            ),
            explainEnabled = false,
        )
    }

    override fun rawQuery(command: DebugSearchUseCase.RawQueryCommand): DebugSearchUseCase.RawQueryResult {
        val searchRequest = SearchRequest.Builder()
            .index(command.indexName)
            .query { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m -> m.match { it.field("name").query(FieldValue.of(command.query)) } }
                            b.filter { f -> f.term { it.field("status").value(FieldValue.of("ACTIVE")) } }
                            b
                        }
                    }
                    command.functionScores.forEach { fnc -> applyFunctionScore(fs, fnc) }
                    fs.scoreMode(FunctionScoreMode.Sum)
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .sort(
                SortOptions.of { s -> s.score { it.order(SortOrder.Desc) } },
                SortOptions.of { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } },
            )
            .from(0)
            .size(command.topK)
            .build()

        val response = client.search(searchRequest, ProductSearchDocument::class.java)
        val docs = response.hits().hits()
            .mapNotNull { hit -> hit.source()?.let { it.toDomain() to (hit.score() ?: 0.0) } }
        return DebugSearchUseCase.RawQueryResult(
            totalElements = response.hits().total()?.value() ?: 0L,
            results = docs.mapIndexed { idx, (doc, score) ->
                scoredItem(rank = idx, doc = doc, esScore = score, finalScore = score, weights = null, banditSample = null)
            },
        )
    }

    private fun scoredItem(
        rank: Int,
        doc: ProductDocument,
        esScore: Double,
        finalScore: Double,
        weights: DebugSearchUseCase.WeightSnapshot?,
        banditSample: Double?,
    ) = DebugSearchUseCase.ScoredItem(
        rank = rank,
        id = doc.id,
        name = doc.name,
        categoryId = doc.categoryId,
        esScore = esScore,
        finalScore = finalScore,
        features = DebugSearchUseCase.FeatureBreakdown(
            popularityScore = doc.popularityScore,
            ctr = doc.ctr,
            ctrRaw = doc.ctrRaw,
            cvr = doc.cvr,
            cvrRaw = doc.cvrRaw,
            gmv7d = doc.gmv7d,
            gmv30d = doc.gmv30d,
        ),
        weights = weights,
        banditSample = banditSample,
    )

    private fun weightSnapshot(props: RankingProperties) = DebugSearchUseCase.WeightSnapshot(
        popularity = props.popularityWeight,
        ctr = props.ctrWeight,
        cvr = props.cvrWeight,
        gmv7d = props.gmv7dWeight,
        gmv30d = props.gmv30dWeight,
        freshness = props.freshness.weight,
    )

    private fun rankingSnapshot(props: RankingProperties) = DebugSearchUseCase.RankingSnapshot(
        popularityWeight = props.popularityWeight,
        ctrWeight = props.ctrWeight,
        cvrWeight = props.cvrWeight,
        gmv7dWeight = props.gmv7dWeight,
        gmv30dWeight = props.gmv30dWeight,
        freshness = DebugSearchUseCase.FreshnessSnapshot(
            weight = props.freshness.weight,
            origin = props.freshness.origin,
            scale = props.freshness.scale,
            offset = props.freshness.offset,
            decay = props.freshness.decay,
        ),
    )

    private fun applyFunctionScore(
        fs: FunctionScoreQuery.Builder,
        config: DebugSearchUseCase.FunctionScoreSpec,
    ) {
        when (config.type) {
            "fieldValueFactor" -> fs.functions { fn ->
                fn.fieldValueFactor { fvf ->
                    fvf.field(config.field)
                        .factor(config.weight.toFloat())
                        .modifier(FieldValueFactorModifier.Log1p)
                        .missing(0.0)
                }
                fn.weight(1.0f)
            }
            "gauss" -> fs.functions { fn ->
                fn.gauss { g ->
                    g.field(config.field)
                        .placement { p ->
                            p.origin(JsonData.of(config.origin ?: "now"))
                                .scale(JsonData.of(config.scale ?: "14d"))
                                .offset(JsonData.of(config.offset ?: "0d"))
                                .decay(config.decay ?: 0.5)
                        }
                }
                fn.weight(config.weight.toFloat())
            }
            else -> log.warn { "Unknown function score type: ${config.type}" }
        }
    }
}
