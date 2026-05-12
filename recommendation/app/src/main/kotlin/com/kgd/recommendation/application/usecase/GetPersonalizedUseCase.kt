package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.port.EmbeddingAnnPort
import com.kgd.recommendation.port.RankingPort
import com.kgd.recommendation.port.UserMetadataPort
import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Phase 3 + 4 — Two-Tower retrieval + Wide & Deep ranking 기반 personalized 추천 (ADR-0044/0046/0047).
 *
 * Funnel (학습 §01 §5):
 *   1) Retrieval: Two-Tower (recommendation-ann /search) — Top-100 후보 (RETRIEVAL_K)
 *   2) Ranking:   Wide & Deep (recommendation-ann /rank) — Top-N 정밀 재정렬
 *   3) Boost / Cold-start fallback: 결과 부족 시 (city, category) CB 결합
 *
 * Cold-start fallback chain (§17):
 * - action_count < MIN_ACTIONS_FOR_PERSONALIZED → CB 직행
 * - retrieval 결과 부족 → user 선호 (city, category) 추론 → CB 로 보완
 * - retrieval 결과 충분 → ranking → Top-N
 */
@Service
class GetPersonalizedUseCase(
    private val annPort: EmbeddingAnnPort,
    private val rankingPort: RankingPort,
    private val userMetadata: UserMetadataPort,
    private val categoryBest: GetCategoryBestUseCase,
) {
    private val logger = KotlinLogging.logger {}

    fun execute(userId: Long, limit: Int, defaultCityId: Long = 1, defaultCategoryId: Long = 1): Recommendation {
        require(userId > 0) { "userId must be > 0, got $userId" }
        require(limit in 1..MAX_LIMIT) { "limit must be in 1..$MAX_LIMIT, got $limit" }

        val actionCount = userMetadata.getActionCount(userId)

        // Hard cold-start: 신규 또는 행동 매우 적은 사용자 → CB 직행
        if (actionCount < MIN_ACTIONS_FOR_PERSONALIZED) {
            logger.debug { "userId=$userId actionCount=$actionCount < $MIN_ACTIONS_FOR_PERSONALIZED → CB fallback" }
            return fallbackToCategoryBest(userId, limit, defaultCityId, defaultCategoryId, source = "personalized-cold-start")
        }

        // Stage 1 Retrieval — Top-100 (또는 limit×5, 더 작은 값)
        val retrievalK = maxOf(limit * 5, RETRIEVAL_K_DEFAULT)
        val annCandidates = annPort.retrievePersonalized(userId, retrievalK)

        if (annCandidates.size < (limit + 1) / 2) {
            // Retrieval 결과 부족 → user 선호 context 로 CB 결합
            val preferred = userMetadata.inferPreferredContext(userId)
            val cb = if (preferred != null) {
                categoryBest.execute(preferred.cityId, preferred.categoryId, limit)
            } else {
                categoryBest.execute(defaultCityId, defaultCategoryId, limit)
            }
            val existingIds = annCandidates.map { it.itemId }.toSet()
            val cbFiltered = cb.items.filter { it.itemId !in existingIds }.take(limit - annCandidates.size)
            return Recommendation(
                type = RecommendationType.PERSONALIZED,
                userId = userId,
                context = RecommendationContext(
                    cityId = preferred?.cityId,
                    categoryId = preferred?.categoryId,
                ),
                items = annCandidates + cbFiltered,
                generatedAt = Instant.now(),
            )
        }

        // Stage 2 Ranking — Wide & Deep 재정렬
        val userCity = userMetadata.inferPreferredContext(userId)?.cityId ?: 0L
        val ranked = rankingPort.rerank(userId, userCity, annCandidates, limit)

        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = RecommendationContext(cityId = if (userCity > 0) userCity else null),
            items = ranked.ifEmpty { annCandidates.take(limit) },
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
        // 결과 type 은 PERSONALIZED 로 유지 (호출자의 컨텍스트), source 로 fallback 표시
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
    }
}
