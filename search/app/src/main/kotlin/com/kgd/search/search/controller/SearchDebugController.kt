package com.kgd.search.presentation.search.controller

import co.elastic.clients.elasticsearch._types.SortOptions
import co.elastic.clients.elasticsearch._types.SortOrder
import co.elastic.clients.elasticsearch._types.Time
import co.elastic.clients.elasticsearch._types.query_dsl.FieldValueFactorModifier
import co.elastic.clients.elasticsearch._types.query_dsl.FunctionBoostMode
import co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreMode
import com.kgd.common.response.ApiResponse
import com.kgd.search.bandit.BanditProperties
import com.kgd.search.bandit.DiversityProperties
import com.kgd.search.bandit.MultiScopeBanditBlender
import com.kgd.search.bandit.SellerDiversityReranker
import com.kgd.search.bandit.ThompsonReranker
import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.elasticsearch.ProductEsDocument
import com.kgd.search.infrastructure.elasticsearch.RankingProperties
import com.kgd.search.infrastructure.elasticsearch.RankingQueryBuilder
import com.kgd.search.infrastructure.elasticsearch.RankingVariantsProperties
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.client.elc.NativeQuery
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus

/**
 * ADR-0050 Phase 4 UI — 검색 디버그/실험 API.
 *
 * - GET  /api/v1/search/debug?query=&variant=&topK=&explain=true
 *     score breakdown (popularity / ctr / cvr / gmv / freshness / bandit / final) 반환
 * - POST /api/v1/search/debug/raw-query
 *     관리자가 직접 ES Native query (JSON) 를 던져서 결과 확인
 * - GET  /api/v1/search/debug/fields
 *     ProductEsDocument 필드 메타 (admin-fe query builder 토글 생성용)
 *
 * 권한: ADMIN. Gateway 측 인증 필터 + @PreAuthorize.
 */
@RestController
@RequestMapping("/api/v1/search/debug")
class SearchDebugController(
    private val rankingProperties: RankingProperties,
    private val rankingVariants: RankingVariantsProperties,
    private val banditProperties: BanditProperties,
    private val diversityProperties: DiversityProperties,
    private val thompsonReranker: ThompsonReranker,
    private val sellerDiversityReranker: SellerDiversityReranker,
    private val blender: MultiScopeBanditBlender,
    private val queryBuilder: RankingQueryBuilder,
    private val elasticsearchOperations: ElasticsearchOperations
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @GetMapping
    fun debug(
        @RequestParam query: String,
        @RequestParam(defaultValue = "live") variant: String,
        @RequestParam(defaultValue = "20") topK: Int,
        @RequestParam(defaultValue = "false") explain: Boolean,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?
    ): ApiResponse<DebugResponse> {
        requireAdmin(roles)
        val pageable = PageRequest.of(0, topK)
        // variant 분기: "live" 또는 매핑 없는 이름은 default RankingProperties.
        val effectiveProps = if (variant == "live") rankingProperties
            else rankingVariants.variants[variant] ?: rankingProperties

        val hits = elasticsearchOperations.search(
            queryBuilder.build(query, pageable, effectiveProps),
            ProductEsDocument::class.java
        )
        val originalDocs = hits.searchHits.map { it.content.toDomain() to it.score.toDouble() }

        val afterThompson = thompsonReranker.rerank(originalDocs)
        val afterDiversity = sellerDiversityReranker.rerank(afterThompson)

        val banditSamples = blender.blend(originalDocs.map { it.first })

        val results = afterDiversity.mapIndexed { idx, (doc, finalScore) ->
            val esScore = originalDocs.firstOrNull { it.first.id == doc.id }?.second ?: 0.0
            ScoredItem(
                rank = idx,
                id = doc.id,
                name = doc.name,
                categoryId = doc.categoryId,
                esScore = esScore,
                finalScore = finalScore,
                features = FeatureBreakdown(
                    popularityScore = doc.popularityScore,
                    ctr = doc.ctr,
                    ctrRaw = doc.ctrRaw,
                    cvr = doc.cvr,
                    cvrRaw = doc.cvrRaw,
                    gmv7d = doc.gmv7d,
                    gmv30d = doc.gmv30d
                ),
                weights = WeightSnapshot(
                    popularity = effectiveProps.popularityWeight,
                    ctr = effectiveProps.ctrWeight,
                    cvr = effectiveProps.cvrWeight,
                    gmv7d = effectiveProps.gmv7dWeight,
                    gmv30d = effectiveProps.gmv30dWeight,
                    freshness = effectiveProps.freshness.weight
                ),
                banditSample = banditSamples[doc.id]
            )
        }

        return ApiResponse.success(
            DebugResponse(
                variant = variant,
                query = query,
                totalElements = hits.totalHits,
                results = results,
                config = ConfigSnapshot(
                    ranking = effectiveProps,
                    bandit = BanditSnapshot(
                        enabled = banditProperties.enabled,
                        topN = banditProperties.topN,
                        hybridWeight = banditProperties.hybridWeight,
                        scopes = banditProperties.effectiveScopes().map { it.name }
                    ),
                    diversity = DiversitySnapshot(
                        enabled = diversityProperties.enabled,
                        maxPerSeller = diversityProperties.maxPerSeller,
                        topK = diversityProperties.topK
                    )
                ),
                explainEnabled = explain
            )
        )
    }

    @PostMapping("/raw-query")
    fun rawQuery(
        @RequestBody request: RawQueryRequest,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?
    ): ApiResponse<RawQueryResponse> {
        requireAdmin(roles)
        require(request.indexName in ALLOWED_INDICES) { "indexName not allowed: ${request.indexName}" }

        val nq = NativeQuery.builder()
            .withQuery { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.must { m -> m.match { it.field("name").query(request.query) } }
                            b.filter { f -> f.term { it.field("status").value("ACTIVE") } }
                            b
                        }
                    }
                    request.functionScores.forEach { fnc -> applyFunctionScore(fs, fnc) }
                    fs.scoreMode(FunctionScoreMode.Sum)
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .withSort(
                SortOptions.of { s -> s.score { it.order(SortOrder.Desc) } },
                SortOptions.of { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } }
            )
            .withPageable(PageRequest.of(0, request.topK))
            .build()

        val hits = elasticsearchOperations.search(nq, ProductEsDocument::class.java, IndexCoordinates.of(request.indexName))
        return ApiResponse.success(
            RawQueryResponse(
                totalElements = hits.totalHits,
                results = hits.searchHits.mapIndexed { idx, h ->
                    val doc = h.content.toDomain()
                    ScoredItem(
                        rank = idx,
                        id = doc.id,
                        name = doc.name,
                        categoryId = doc.categoryId,
                        esScore = h.score.toDouble(),
                        finalScore = h.score.toDouble(),
                        features = FeatureBreakdown(
                            popularityScore = doc.popularityScore,
                            ctr = doc.ctr,
                            ctrRaw = doc.ctrRaw,
                            cvr = doc.cvr,
                            cvrRaw = doc.cvrRaw,
                            gmv7d = doc.gmv7d,
                            gmv30d = doc.gmv30d
                        ),
                        weights = null,
                        banditSample = null
                    )
                }
            )
        )
    }

    @GetMapping("/fields")
    fun fields(@RequestHeader(name = "X-User-Roles", required = false) roles: String?): ApiResponse<List<FieldMeta>> {
        requireAdmin(roles)
        return ApiResponse.success(SUPPORTED_FIELDS)
    }

    /**
     * Gateway 의 AuthenticationGatewayFilter 가 X-User-Roles 헤더로 역할을 전달 (CSV).
     * ADMIN 미포함 시 403.
     */
    private fun requireAdmin(roles: String?) {
        val parsed = roles?.split(",")?.map { it.trim() } ?: emptyList()
        if ("ROLE_ADMIN" !in parsed && "ADMIN" !in parsed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN role required")
        }
    }

    private fun applyFunctionScore(
        fs: co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreQuery.Builder,
        config: FunctionScoreSpec
    ) {
        when (config.type) {
            "fieldValueFactor" -> fs.functions { fn ->
                fn.fieldValueFactor { fvf ->
                    fvf.field(config.field)
                        .factor(config.weight)
                        .modifier(FieldValueFactorModifier.Log1p)
                        .missing(0.0)
                }
                fn.weight(1.0)
            }
            "gauss" -> fs.functions { fn ->
                fn.gauss { g: co.elastic.clients.elasticsearch._types.query_dsl.DecayFunction.Builder ->
                    g.date { d ->
                        d.field(config.field)
                            .placement { p ->
                                p.origin(config.origin ?: "now")
                                    .scale(Time.of { it.time(config.scale ?: "14d") })
                                    .offset(Time.of { it.time(config.offset ?: "0d") })
                                    .decay(config.decay ?: 0.5)
                            }
                    }
                }
                fn.weight(config.weight)
            }
            else -> log.warn("Unknown function score type: {}", config.type)
        }
    }

    data class DebugResponse(
        val variant: String,
        val query: String,
        val totalElements: Long,
        val results: List<ScoredItem>,
        val config: ConfigSnapshot,
        val explainEnabled: Boolean
    )

    data class ScoredItem(
        val rank: Int,
        val id: String,
        val name: String,
        val categoryId: String?,
        val esScore: Double,
        val finalScore: Double,
        val features: FeatureBreakdown,
        val weights: WeightSnapshot?,
        val banditSample: Double?
    )

    data class FeatureBreakdown(
        val popularityScore: Double,
        val ctr: Double,
        val ctrRaw: Double,
        val cvr: Double,
        val cvrRaw: Double,
        val gmv7d: Double,
        val gmv30d: Double
    )

    data class WeightSnapshot(
        val popularity: Double,
        val ctr: Double,
        val cvr: Double,
        val gmv7d: Double,
        val gmv30d: Double,
        val freshness: Double
    )

    data class ConfigSnapshot(
        val ranking: RankingProperties,
        val bandit: BanditSnapshot,
        val diversity: DiversitySnapshot
    )

    data class BanditSnapshot(
        val enabled: Boolean,
        val topN: Int,
        val hybridWeight: Double,
        val scopes: List<String>
    )

    data class DiversitySnapshot(
        val enabled: Boolean,
        val maxPerSeller: Int,
        val topK: Int
    )

    data class RawQueryRequest(
        val indexName: String = "products",
        val query: String,
        val topK: Int = 20,
        val functionScores: List<FunctionScoreSpec> = emptyList()
    )

    data class FunctionScoreSpec(
        val type: String,  // "fieldValueFactor" | "gauss"
        val field: String,
        val weight: Double = 1.0,
        // gauss decay only
        val origin: String? = null,
        val scale: String? = null,
        val offset: String? = null,
        val decay: Double? = null
    )

    data class RawQueryResponse(
        val totalElements: Long,
        val results: List<ScoredItem>
    )

    data class FieldMeta(
        val name: String,
        val type: String,
        val supportedFunctions: List<String>
    )

    companion object {
        private val ALLOWED_INDICES = setOf("products")

        private val SUPPORTED_FIELDS = listOf(
            FieldMeta("name", "text", listOf("match")),
            FieldMeta("status", "keyword", listOf("term")),
            FieldMeta("categoryId", "keyword", listOf("term")),
            FieldMeta("price", "double", listOf("range", "fieldValueFactor")),
            FieldMeta("popularityScore", "double", listOf("fieldValueFactor")),
            FieldMeta("ctr", "double", listOf("fieldValueFactor")),
            FieldMeta("cvr", "double", listOf("fieldValueFactor")),
            FieldMeta("gmv7d", "double", listOf("fieldValueFactor")),
            FieldMeta("gmv30d", "double", listOf("fieldValueFactor")),
            FieldMeta("createdAt", "date", listOf("range", "gauss"))
        )
    }
}
