package com.kgd.search.application.debug.usecase

/**
 * ADR-0050 Phase 4 UI — 검색 디버그/실험 (ADMIN 전용).
 *
 * 응답 필드명은 admin-fe 의 `api/searchDebug.ts` 와 1:1 이다 — 바꾸면 화면이 조용히 빈다.
 * 권한 확인은 컨트롤러 책임.
 */
interface DebugSearchUseCase {
    fun debug(query: String, variant: String, topK: Int, explain: Boolean): DebugResult
    fun rawQuery(command: RawQueryCommand): RawQueryResult
    fun supportedFields(): List<FieldMeta>

    data class DebugResult(
        val variant: String,
        val query: String,
        val totalElements: Long,
        val results: List<ScoredItem>,
        val config: ConfigSnapshot,
        val explainEnabled: Boolean,
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
        val banditSample: Double?,
    )

    data class FeatureBreakdown(
        val popularityScore: Double,
        val ctr: Double,
        val ctrRaw: Double,
        val cvr: Double,
        val cvrRaw: Double,
        val gmv7d: Double,
        val gmv30d: Double,
    )

    data class WeightSnapshot(
        val popularity: Double,
        val ctr: Double,
        val cvr: Double,
        val gmv7d: Double,
        val gmv30d: Double,
        val freshness: Double,
    )

    data class ConfigSnapshot(
        val ranking: RankingSnapshot,
        val bandit: BanditSnapshot,
        val diversity: DiversitySnapshot,
    )

    /** `search.ranking` 설정의 사본. 필드명이 곧 응답 JSON 이라 프로퍼티 클래스와 같게 유지한다. */
    data class RankingSnapshot(
        val popularityWeight: Double,
        val ctrWeight: Double,
        val cvrWeight: Double,
        val gmv7dWeight: Double,
        val gmv30dWeight: Double,
        val freshness: FreshnessSnapshot,
    )

    data class FreshnessSnapshot(
        val weight: Double,
        val origin: String,
        val scale: String,
        val offset: String,
        val decay: Double,
    )

    data class BanditSnapshot(
        val enabled: Boolean,
        val topN: Int,
        val hybridWeight: Double,
        val scopes: List<String>,
    )

    data class DiversitySnapshot(
        val enabled: Boolean,
        val maxPerSeller: Int,
        val topK: Int,
    )

    data class RawQueryCommand(
        val indexName: String,
        val query: String,
        val topK: Int,
        val functionScores: List<FunctionScoreSpec>,
    )

    data class FunctionScoreSpec(
        val type: String,  // "fieldValueFactor" | "gauss"
        val field: String,
        val weight: Double = 1.0,
        // gauss decay only
        val origin: String? = null,
        val scale: String? = null,
        val offset: String? = null,
        val decay: Double? = null,
    )

    data class RawQueryResult(
        val totalElements: Long,
        val results: List<ScoredItem>,
    )

    data class FieldMeta(
        val name: String,
        val type: String,
        val supportedFunctions: List<String>,
    )
}
