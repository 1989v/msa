package com.kgd.recommendation.presentation.dto

import com.kgd.recommendation.recommendation.Recommendation
import com.kgd.recommendation.recommendation.RecommendationContext
import com.kgd.recommendation.recommendation.RecommendationItem
import com.kgd.recommendation.recommendation.RecommendationType
import java.time.Instant

data class RecommendationDto(
    val type: RecommendationType,
    val userId: Long?,
    val context: RecommendationContext,
    val items: List<RecommendationItemDto>,
    val generatedAt: Instant,
) {
    companion object {
        fun from(rec: Recommendation): RecommendationDto = RecommendationDto(
            type = rec.type,
            userId = rec.userId,
            context = rec.context,
            items = rec.items.map { RecommendationItemDto.from(it) },
            generatedAt = rec.generatedAt,
        )
    }
}

data class RecommendationItemDto(
    val itemId: Long,
    val score: Double,
    val source: String,
) {
    companion object {
        fun from(item: RecommendationItem): RecommendationItemDto = RecommendationItemDto(
            itemId = item.itemId,
            score = item.score,
            source = item.source,
        )
    }
}
