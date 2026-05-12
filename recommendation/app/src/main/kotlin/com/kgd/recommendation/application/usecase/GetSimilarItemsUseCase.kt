package com.kgd.recommendation.application.usecase

import com.kgd.recommendation.port.ItemMetadataPort
import com.kgd.recommendation.port.ItemSimilarityPort
import com.kgd.recommendation.port.RecommendationRepository
import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Phase 2 — Item-Item CF (PPMI) 기반 similar-items 추천.
 *
 * Cold-start fallback chain (§17 §10):
 * 1. ItemSimilarityPort 로 사전 계산된 유사 item 조회
 * 2. 결과가 부족 (`< limit/2`) 하면 같은 (city, category) 의 Category Best 로 보완
 * 3. metadata 조회 실패 시 빈 응답
 */
@Service
class GetSimilarItemsUseCase(
    private val itemSimilarityPort: ItemSimilarityPort,
    private val itemMetadataPort: ItemMetadataPort,
    private val recommendationRepository: RecommendationRepository,
) {
    private val logger = KotlinLogging.logger {}

    fun execute(itemId: Long, limit: Int): Recommendation {
        require(itemId > 0) { "itemId must be > 0, got $itemId" }
        require(limit in 1..MAX_LIMIT) { "limit must be in 1..$MAX_LIMIT, got $limit" }

        // 1. 사전 계산된 similar items
        val similar = itemSimilarityPort.findSimilar(itemId, limit)

        val needFallback = similar.size < (limit + 1) / 2  // 50% 미만이면 fallback
        if (!needFallback) {
            return Recommendation(
                type = RecommendationType.SIMILAR_ITEMS,
                userId = null,
                context = RecommendationContext(sourceItemId = itemId),
                items = similar,
                generatedAt = Instant.now(),
            )
        }

        // 2. Cold-start: same (city, category) 의 CB 로 보완
        val metadata = itemMetadataPort.getCityAndCategory(itemId)
        if (metadata == null) {
            logger.warn { "GetSimilarItemsUseCase: itemId=$itemId metadata 없음 — similar 결과만 반환 (size=${similar.size})" }
            return Recommendation(
                type = RecommendationType.SIMILAR_ITEMS,
                userId = null,
                context = RecommendationContext(sourceItemId = itemId),
                items = similar,
                generatedAt = Instant.now(),
            )
        }

        val remaining = limit - similar.size
        val cb = recommendationRepository.findCategoryBest(metadata.cityId, metadata.categoryId, remaining + similar.size)
        // similar 에 이미 있는 item 은 dedupe
        val existingIds = similar.map { it.itemId }.toSet() + itemId
        val cbFiltered = cb.items.filter { it.itemId !in existingIds }.take(remaining)

        return Recommendation(
            type = RecommendationType.SIMILAR_ITEMS,
            userId = null,
            context = RecommendationContext(
                cityId = metadata.cityId,
                categoryId = metadata.categoryId,
                sourceItemId = itemId,
            ),
            items = similar + cbFiltered,
            generatedAt = Instant.now(),
        )
    }

    companion object {
        const val MAX_LIMIT = 100
    }
}
