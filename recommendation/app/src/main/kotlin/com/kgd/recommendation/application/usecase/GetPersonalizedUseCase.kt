package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.port.EmbeddingAnnPort
import com.kgd.recommendation.port.UserMetadataPort
import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Phase 3 — Two-Tower retrieval 기반 personalized 추천.
 *
 * Cold-start fallback chain (§17):
 * 1. 활성 사용자 (action_count >= MIN_ACTIONS): recommendation-ann 호출 → Top-K
 * 2. 결과 부족 시 사용자의 선호 (city, category) 추론 → CB 로 보완
 * 3. 신규/anonymous 사용자: 곧장 CB (선호 추정 가능하면) 또는 default fallback
 */
@Service
class GetPersonalizedUseCase(
    private val annPort: EmbeddingAnnPort,
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

        // Active user: ANN retrieval
        val annItems = annPort.retrievePersonalized(userId, limit)

        if (annItems.size >= (limit + 1) / 2) {
            // 충분한 결과
            return Recommendation(
                type = RecommendationType.PERSONALIZED,
                userId = userId,
                context = RecommendationContext(),
                items = annItems.take(limit),
                generatedAt = Instant.now(),
            )
        }

        // ANN 결과 부족 → user 선호 context 로 CB 결합
        val preferred = userMetadata.inferPreferredContext(userId)
        val cb = if (preferred != null) {
            categoryBest.execute(preferred.cityId, preferred.categoryId, limit)
        } else {
            categoryBest.execute(defaultCityId, defaultCategoryId, limit)
        }

        val existingIds = annItems.map { it.itemId }.toSet()
        val cbFiltered = cb.items.filter { it.itemId !in existingIds }.take(limit - annItems.size)

        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = RecommendationContext(
                cityId = preferred?.cityId,
                categoryId = preferred?.categoryId,
            ),
            items = annItems + cbFiltered,
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
    }
}
