package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.infrastructure.bandit.BanditPolicy
import com.kgd.recommendation.infrastructure.client.RecommendationExperimentClient
import com.kgd.recommendation.port.EmbeddingAnnPort
import com.kgd.recommendation.port.RankingPort
import com.kgd.recommendation.port.UserMetadataPort
import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Phase 3 + 4 (+ 4.5 A/B) — Two-Tower retrieval + Wide & Deep ranking + Experiment variant 분기.
 *
 * Funnel (학습 §01 §5):
 *   1) Retrieval: Two-Tower (recommendation-ann /search) — Top-100 후보
 *   2) Ranking:   Wide & Deep (recommendation-ann /rank) — Top-N 정밀 재정렬
 *   3) Cold-start fallback chain (§17)
 *
 * A/B 분기 (Phase 4.5, ADR-0048):
 *   - control            → Phase 1 CB 만 (사용자 선호 context)
 *   - retrieval-only     → Phase 3 retrieval, ranking 생략
 *   - retrieval-and-rank → 전체 funnel (default)
 *
 * experiment 호출 실패 시 graceful: default variant (retrieval-and-rank) 적용.
 */
@Service
class GetPersonalizedUseCase(
    private val annPort: EmbeddingAnnPort,
    private val rankingPort: RankingPort,
    private val userMetadata: UserMetadataPort,
    private val categoryBest: GetCategoryBestUseCase,
    private val experimentClient: RecommendationExperimentClient,
    private val banditPolicy: BanditPolicy,
    @Value("\${recommendation.experiment.id:0}") private val experimentId: Long,
) {
    private val logger = KotlinLogging.logger {}

    fun execute(userId: Long, limit: Int, defaultCityId: Long = 1, defaultCategoryId: Long = 1): Recommendation {
        require(userId > 0) { "userId must be > 0, got $userId" }
        require(limit in 1..MAX_LIMIT) { "limit must be in 1..$MAX_LIMIT, got $limit" }

        val actionCount = userMetadata.getActionCount(userId)

        // Hard cold-start: 신규 또는 행동 매우 적은 사용자 → CB 직행 (variant 무관)
        if (actionCount < MIN_ACTIONS_FOR_PERSONALIZED) {
            return fallbackToCategoryBest(userId, limit, defaultCityId, defaultCategoryId, "personalized-cold-start")
        }

        // Variant 결정 우선순위:
        //   1. Bandit (Phase 6, Thompson sampling) — `recommendation.bandit.enabled=true`
        //   2. A/B (Phase 4.5, experiment service) — `recommendation.experiment.id > 0`
        //   3. Default funnel (retrieval-and-rank)
        val variant = banditPolicy.selectIfEnabled()
            ?: (if (experimentId > 0) experimentClient.getVariant(experimentId, userId) else null)
            ?: DEFAULT_VARIANT

        banditPolicy.recordImpression(variant)

        return when (variant) {
            "control" -> fallbackToCategoryBest(userId, limit, defaultCityId, defaultCategoryId, "ab-control-cb")
            "retrieval-only" -> retrievalOnly(userId, limit, defaultCityId, defaultCategoryId)
            "retrieval-and-rank", DEFAULT_VARIANT -> retrievalAndRank(userId, limit, defaultCityId, defaultCategoryId, "wide_and_deep")
            "retrieval-and-rank-dlrm" -> retrievalAndRank(userId, limit, defaultCityId, defaultCategoryId, "dlrm")
            else -> {
                logger.warn { "Unknown variant '$variant' for userId=$userId — default funnel" }
                retrievalAndRank(userId, limit, defaultCityId, defaultCategoryId, "wide_and_deep")
            }
        }.let { rec ->
            // variant 메타 데이터를 context 에는 못 넣음 (기존 도메인 변경 회피).
            // source 에 variant 접두사 추가하여 A/B 분석 가능하게.
            if (variant != DEFAULT_VARIANT && rec.items.isNotEmpty()) {
                rec.copy(items = rec.items.map { it.copy(source = "${it.source}|ab:$variant") })
            } else {
                rec
            }
        }
    }

    private fun retrievalOnly(userId: Long, limit: Int, defaultCityId: Long, defaultCategoryId: Long): Recommendation {
        val retrievalK = maxOf(limit * 5, RETRIEVAL_K_DEFAULT)
        val annCandidates = annPort.retrievePersonalized(userId, retrievalK)
        if (annCandidates.size < (limit + 1) / 2) {
            return mergeWithCb(userId, annCandidates, limit, defaultCityId, defaultCategoryId)
        }
        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = RecommendationContext(),
            items = annCandidates.take(limit),
            generatedAt = Instant.now(),
        )
    }

    private fun retrievalAndRank(userId: Long, limit: Int, defaultCityId: Long, defaultCategoryId: Long, rankerType: String): Recommendation {
        val retrievalK = maxOf(limit * 5, RETRIEVAL_K_DEFAULT)
        val annCandidates = annPort.retrievePersonalized(userId, retrievalK)
        if (annCandidates.size < (limit + 1) / 2) {
            return mergeWithCb(userId, annCandidates, limit, defaultCityId, defaultCategoryId)
        }
        val userCity = userMetadata.inferPreferredContext(userId)?.cityId ?: 0L
        val ranked = rankingPort.rerank(userId, userCity, annCandidates, limit, rankerType)
        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = RecommendationContext(cityId = if (userCity > 0) userCity else null),
            items = ranked.ifEmpty { annCandidates.take(limit) },
            generatedAt = Instant.now(),
        )
    }

    private fun mergeWithCb(
        userId: Long,
        ann: List<com.kgd.recommendation.recommendation.RecommendationItem>,
        limit: Int,
        defaultCityId: Long,
        defaultCategoryId: Long,
    ): Recommendation {
        val preferred = userMetadata.inferPreferredContext(userId)
        val cb = if (preferred != null) {
            categoryBest.execute(preferred.cityId, preferred.categoryId, limit)
        } else {
            categoryBest.execute(defaultCityId, defaultCategoryId, limit)
        }
        val existingIds = ann.map { it.itemId }.toSet()
        val cbFiltered = cb.items.filter { it.itemId !in existingIds }.take(limit - ann.size)
        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = RecommendationContext(
                cityId = preferred?.cityId,
                categoryId = preferred?.categoryId,
            ),
            items = ann + cbFiltered,
            generatedAt = Instant.now(),
        )
    }

    private fun fallbackToCategoryBest(
        userId: Long,
        limit: Int,
        defaultCityId: Long,
        defaultCategoryId: Long,
        source: String,
    ): Recommendation {
        val preferred = userMetadata.inferPreferredContext(userId)
        val cb = if (preferred != null) {
            categoryBest.execute(preferred.cityId, preferred.categoryId, limit)
        } else {
            categoryBest.execute(defaultCityId, defaultCategoryId, limit)
        }
        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = cb.context,
            items = cb.items.map { it.copy(source = source) },
            generatedAt = Instant.now(),
        )
    }

    companion object {
        const val MAX_LIMIT = 100
        const val MIN_ACTIONS_FOR_PERSONALIZED = 5L
        const val RETRIEVAL_K_DEFAULT = 100
        const val DEFAULT_VARIANT = "retrieval-and-rank"
    }
}
